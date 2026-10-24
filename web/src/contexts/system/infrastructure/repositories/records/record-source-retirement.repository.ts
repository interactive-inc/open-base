import type { SystemD1Context } from "@system/configuration/system-context"
import { RecordSourceRetirementEntity } from "@system/domain/entities/record-source-retirement.entity"
import type { ExecutionAuthorizationEntity } from "@system/domain/entities/execution-authorization.entity"
import { SystemD1AuthorizedExecutionAdapter } from "@system/infrastructure/adapters/workflow/system-d1-authorized-execution.adapter"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context &
  Readonly<{
    assertions: ReadonlyArray<D1PreparedStatement>
  }>

/** 撤去確定と監査を実行許可の消費へ接続し、停止世代ごとに一度だけ保存する。 */
export class RecordSourceRetirementRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async finalize(
    input: Readonly<{
      retirement: RecordSourceRetirementEntity
      authorization: ExecutionAuthorizationEntity
      executionGuards: ReadonlyArray<D1PreparedStatement>
    }>,
  ): Promise<true | Error> {
    const snapshot = input.retirement.snapshot
    const authorization = input.authorization
    if (
      this.c.assertions.length === 0 ||
      input.executionGuards.length === 0 ||
      authorization.id !== snapshot.executionAuthorizationId ||
      authorization.caseId !== snapshot.caseId ||
      authorization.operationKey !== "system.record.retire" ||
      authorization.proposalDigest !== snapshot.proposalDigest ||
      authorization.grantedToAccountId !== snapshot.actorAccountId
    )
      return new Error("record retirement execution authority differs")
    const audit = input.retirement.audit()
    if (audit instanceof Error) return audit
    const executionWindow = this.c.env.DB.prepare(`SELECT CASE WHEN
          max(?1, CAST(round((julianday('now')-2440587.5)*86400000) AS INTEGER)) < ?2
          THEN 1 ELSE json_extract('{}','record_retirement_authorization_expired') END`).bind(
      authorization.grantedAt.getTime(),
      authorization.expiresAt.getTime(),
    )
    return new SystemD1AuthorizedExecutionAdapter(this.c).execute({
      authorization,
      proposalDigest: authorization.proposalDigest,
      executedAt: new Date(snapshot.finalizedAt),
      operationStatements: [...this.c.assertions, ...input.executionGuards, executionWindow],
      completionStatements: [
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
        this.c.env.DB.prepare(`INSERT INTO system_record_source_retirements
          (id,freeze_id,plan_id,terminal_receipt_id,proposal_id,case_id,execution_authorization_id,audit_event_id,snapshot_json)
          VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`).bind(
          snapshot.id,
          snapshot.freezeId,
          snapshot.planId,
          snapshot.terminalReceiptId,
          snapshot.proposalId,
          snapshot.caseId,
          snapshot.executionAuthorizationId,
          snapshot.auditEventId,
          JSON.stringify(snapshot),
        ),
        ...this.c.assertions,
        executionWindow,
      ],
    })
  }

  async findByFreeze(freezeId: string): Promise<RecordSourceRetirementEntity | null | Error> {
    if (this.c.assertions.length === 0)
      return new Error("record retirement read authority required")
    try {
      const statements = [
        ...this.c.assertions,
        this.c.env.DB.prepare(
          "SELECT snapshot_json FROM system_record_source_retirements WHERE freeze_id=?1",
        ).bind(freezeId),
        ...this.c.assertions,
      ]
      const results = await this.c.env.DB.batch<{ snapshot_json: string }>(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("record retirement read failed")
      const row = results[this.c.assertions.length]?.results[0]
      return row === undefined
        ? null
        : RecordSourceRetirementEntity.restore(JSON.parse(row.snapshot_json))
    } catch (cause) {
      return new Error("record retirement read failed", { cause })
    }
  }
}
