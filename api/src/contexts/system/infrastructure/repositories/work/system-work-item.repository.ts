import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemWorkItemEntity } from "@system/domain/entities/system-work-item.entity"
import { SystemWorkItemError } from "@system/domain/errors"
import type { SystemWorkAuthorization } from "@system/infrastructure/adapters/work/system-work-authorization.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

type Context = SystemD1Context & Readonly<{ authorization: SystemWorkAuthorization }>
type Row = Readonly<{ snapshot_json: string; access_command: string }>
const visible = `(?1=1 OR (current.accountable_account_id=?2 AND current.accountable_principal_id=?3)
  OR (current.assignee_account_id=?2 AND current.assignee_principal_id=?3)
  OR (json_extract(current.snapshot_json,'$.handover.to.accountId')=?2 AND json_extract(current.snapshot_json,'$.handover.to.principalId')=?3))`
const latest = `current.revision=(SELECT max(revision) FROM system_work_item_revisions WHERE work_item_id=current.work_item_id)`

/** 依頼・成果・証拠・監査を同じtransactionで追記し、現在の参加者だけに履歴を開示する。 */
export class SystemWorkItemRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  private parameters() {
    return [
      this.c.authorization.isAdmin ? 1 : 0,
      this.c.authorization.actor.accountId,
      this.c.authorization.actor.principalId,
    ]
  }

  prepareReadAssertion(commandId: string): D1PreparedStatement {
    return this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_work_item_revisions current WHERE ${latest} AND ${visible} AND current.command_id=?4)
      THEN 1 ELSE json_extract('{}','work_item_read_changed') END AS ok`).bind(
      ...this.parameters(),
      commandId,
    )
  }

  async findCurrent(id: string) {
    const records = await this.read(
      this.c.env.DB.prepare(`SELECT current.snapshot_json,current.command_id AS access_command
      FROM system_work_item_revisions current WHERE ${latest} AND ${visible} AND current.work_item_id=?4`).bind(
        ...this.parameters(),
        id,
      ),
    )
    return records instanceof Error ? records : (records.at(0) ?? null)
  }

  async findCommand(commandId: string) {
    const records = await this.read(
      this.c.env.DB.prepare(`SELECT previous.snapshot_json,current.command_id AS access_command
      FROM system_work_item_revisions current JOIN system_work_item_revisions previous ON previous.work_item_id=current.work_item_id
      WHERE ${latest} AND ${visible} AND previous.command_id=?4`).bind(
        ...this.parameters(),
        commandId,
      ),
    )
    return records instanceof Error ? records : (records.at(0) ?? null)
  }

  async list(input: Readonly<{ after: string | null; limit: number }>) {
    return this.read(
      this.c.env.DB.prepare(`SELECT current.snapshot_json,current.command_id AS access_command
      FROM system_work_item_revisions current WHERE ${latest} AND ${visible} AND (?4 IS NULL OR current.work_item_id>?4)
      ORDER BY current.work_item_id LIMIT ?5`).bind(...this.parameters(), input.after, input.limit),
    )
  }

  async history(input: Readonly<{ id: string; after: number; limit: number }>) {
    return this.read(
      this.c.env.DB.prepare(`SELECT previous.snapshot_json,current.command_id AS access_command
      FROM system_work_item_revisions current JOIN system_work_item_revisions previous ON previous.work_item_id=current.work_item_id
      WHERE ${latest} AND ${visible} AND current.work_item_id=?4 AND previous.revision>?5
      ORDER BY previous.revision LIMIT ?6`).bind(
        ...this.parameters(),
        input.id,
        input.after,
        input.limit,
      ),
    )
  }

  private async read(
    statement: D1PreparedStatement,
  ): Promise<ReadonlyArray<SystemWorkItemEntity> | SystemWorkItemError> {
    const assertions = this.c.authorization.assertions()
    if (assertions instanceof Error) return assertions
    try {
      const batch = await this.c.env.DB.batch<Row>([...assertions, statement, ...assertions])
      if (batch.length !== assertions.length * 2 + 1 || batch.some((item) => !item.success))
        return new SystemWorkItemError("unavailable")
      const rows = batch.at(assertions.length)?.results
      if (rows === undefined) return new SystemWorkItemError("unavailable")
      const entities: SystemWorkItemEntity[] = []
      for (const row of rows) {
        const entity = SystemWorkItemEntity.restore(JSON.parse(row.snapshot_json))
        if (entity instanceof Error || !(await entity.verifyResult()))
          return new SystemWorkItemError("unavailable")
        entities.push(entity)
      }
      const finalAssertions = this.c.authorization.assertions()
      if (finalAssertions instanceof Error) return finalAssertions
      const guards = rows.map((row) => this.prepareReadAssertion(row.access_command))
      const verified = await this.c.env.DB.batch([...finalAssertions, ...guards])
      if (
        verified.length !== finalAssertions.length + guards.length ||
        verified.some((item) => !item.success)
      )
        return new SystemWorkItemError("unavailable")
      return entities
    } catch (cause) {
      return this.failure(cause)
    }
  }

  async append(
    entity: SystemWorkItemEntity,
    before: SystemWorkItemEntity | null,
  ): Promise<void | SystemWorkItemError> {
    const value = entity.snapshot
    const audit = entity.audit(before)
    if (audit instanceof Error || !(await entity.verifyResult()))
      return new SystemWorkItemError("invalid", audit)
    const assertions = this.c.authorization.assertions()
    if (assertions instanceof Error) return assertions
    if (
      value.actor.accountId !== this.c.authorization.actor.accountId ||
      value.actor.principalId !== this.c.authorization.actor.principalId ||
      JSON.stringify(value.authentication) !== JSON.stringify(this.c.authorization.authentication)
    )
      return new SystemWorkItemError("forbidden")
    try {
      const statements: D1PreparedStatement[] = [
        ...assertions,
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
      ]
      if (before === null)
        statements.push(
          this.c.env.DB.prepare(`INSERT INTO system_work_items
        (id,title,instructions,acceptance_criteria,created_by_account_id,created_by_principal_id,created_at,due_at,previous_revision_id)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(
            value.id,
            value.title,
            value.instructions,
            value.acceptanceCriteria,
            value.createdBy.accountId,
            value.createdBy.principalId,
            Date.parse(value.createdAt),
            value.dueAt === null ? null : Date.parse(value.dueAt),
            value.previousRevisionId,
          ),
          abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        )
      statements.push(
        this.c.env.DB.prepare(`INSERT INTO system_work_item_revisions
        (id,work_item_id,revision,command_id,action,state,actor_account_id,actor_principal_id,accountable_account_id,accountable_principal_id,
          assignee_account_id,assignee_principal_id,recorded_at,snapshot_json,audit_event_id)
        VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)`).bind(
          crypto.randomUUID(),
          value.id,
          value.revision,
          value.commandId,
          value.action,
          value.state,
          value.actor.accountId,
          value.actor.principalId,
          value.accountable.accountId,
          value.accountable.principalId,
          value.assignee.accountId,
          value.assignee.principalId,
          Date.parse(value.recordedAt),
          JSON.stringify(value),
          value.auditEventId,
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
        ...assertions,
      )
      const batch = await this.c.env.DB.batch(statements)
      if (batch.length !== statements.length || batch.some((item) => !item.success))
        return new SystemWorkItemError("unavailable")
    } catch (cause) {
      return this.failure(cause)
    }
  }

  private failure(cause: unknown): SystemWorkItemError {
    const visited = new Set<Error>()
    for (let error = cause; error instanceof Error && !visited.has(error); error = error.cause) {
      visited.add(error)
      if (
        /work_item_(authorization_changed|actor_unavailable|permission_denied)/.test(error.message)
      )
        return new SystemWorkItemError("forbidden", cause)
      if (
        /UNIQUE constraint failed|work_item_(revision_conflict|read_changed|previous_unavailable)/.test(
          error.message,
        )
      )
        return new SystemWorkItemError("conflict", cause)
      if (
        /work_item_(transition_invalid|recipient_unavailable|evidence_unavailable)/.test(
          error.message,
        )
      )
        return new SystemWorkItemError("invalid", cause)
    }
    return new SystemWorkItemError("unavailable", cause)
  }
}
