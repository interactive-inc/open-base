import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { SystemAuditDisclosureError } from "@system/domain/errors"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** 版と監査を同時に追記し、再送でも現在の管理資格を検査する。 */
export class SystemAuditDisclosurePolicyRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findCommand(commandId: string) {
    return this.read(
      this.c.env.DB.prepare(`SELECT audit.after_json AS snapshot_json
      FROM system_audit_disclosure_policy_revisions policy JOIN system_audit_events audit ON audit.event_id = policy.audit_event_id
      WHERE policy.command_id = ?1`).bind(commandId),
    )
  }

  async findCurrent(scope: string) {
    return this.read(
      this.c.env.DB.prepare(`SELECT audit.after_json AS snapshot_json
      FROM system_audit_disclosure_policy_revisions policy JOIN system_audit_events audit ON audit.event_id = policy.audit_event_id
      WHERE policy.scope = ?1 ORDER BY policy.revision DESC LIMIT 1`).bind(scope),
    )
  }

  private async read(
    statement: D1PreparedStatement,
  ): Promise<SystemAuditDisclosurePolicyEntity | null | Error> {
    try {
      const batch = await this.c.env.DB.batch<{ snapshot_json: string }>([
        ...this.c.assertions,
        statement,
      ])
      if (batch.length !== this.c.assertions.length + 1 || batch.some((result) => !result.success))
        return new SystemAuditDisclosureError("unavailable")
      const row = batch.at(-1)?.results.at(0)
      if (row === undefined) return null
      const entity = SystemAuditDisclosurePolicyEntity.create(JSON.parse(row.snapshot_json))
      return entity instanceof Error
        ? new SystemAuditDisclosureError("unavailable", entity)
        : entity
    } catch (cause) {
      return new SystemAuditDisclosureError("unavailable", cause)
    }
  }

  async append(
    entity: SystemAuditDisclosurePolicyEntity,
    before: SystemAuditDisclosurePolicyEntity | null,
  ): Promise<void | SystemAuditDisclosureError> {
    const audit = entity.audit(before)
    if (audit instanceof Error) return new SystemAuditDisclosureError("invalid", audit)
    const value = entity.snapshot
    try {
      const statements = [
        ...this.c.assertions,
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
        this.c.env.DB.prepare(`INSERT INTO system_audit_disclosure_policy_revisions
        (id, scope, revision, command_id, enabled, allowed_fields_json, allowed_target_types_json, allowed_purposes_json, expires_at, reason, actor_account_id, recorded_at, audit_event_id)
        VALUES (?13, ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`).bind(
          value.scope,
          value.revision,
          value.commandId,
          value.enabled ? 1 : 0,
          JSON.stringify(value.allowedFields),
          value.allowedTargetTypes === null ? null : JSON.stringify(value.allowedTargetTypes),
          value.allowedPurposes === null ? null : JSON.stringify(value.allowedPurposes),
          value.expiresAt === null ? null : Date.parse(value.expiresAt),
          value.reason,
          value.actorAccountId,
          Date.parse(value.recordedAt),
          value.auditEventId,
          crypto.randomUUID(),
        ),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new SystemAuditDisclosureError("unavailable")
    } catch (cause) {
      if (
        cause instanceof Error &&
        /UNIQUE constraint failed|audit_disclosure_revision_conflict|audit_disclosure_scope_unavailable/.test(
          cause.message,
        )
      )
        return new SystemAuditDisclosureError("conflict", cause)
      return new SystemAuditDisclosureError("unavailable", cause)
    }
  }
}
