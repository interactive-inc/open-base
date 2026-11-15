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
      this.c.env.DB.prepare(`SELECT policy.scope, audit.after_json AS snapshot_json
      FROM system_audit_disclosure_policy_revisions policy LEFT JOIN system_audit_events audit ON audit.event_id = policy.audit_event_id
      WHERE policy.command_id = ?1`).bind(commandId),
    )
  }

  async findCurrent(scope: string) {
    return this.read(
      this.c.env.DB.prepare(`SELECT policy.scope, audit.after_json AS snapshot_json
      FROM system_audit_disclosure_policy_revisions policy LEFT JOIN system_audit_events audit ON audit.event_id = policy.audit_event_id
      WHERE policy.scope = ?1 ORDER BY policy.revision DESC LIMIT 1`).bind(scope),
    )
  }

  async findLegacyCurrent(accountId: string) {
    return this.read(
      this.c.env.DB.prepare(`SELECT policy.scope,
        CASE WHEN EXISTS (SELECT 1 FROM system_accounts other WHERE other.id = policy.scope)
          THEN NULL ELSE audit.after_json END AS snapshot_json
        FROM system_accounts owner
        JOIN system_audit_disclosure_policy_revisions policy ON policy.scope = owner.legacy_id
        LEFT JOIN system_audit_events audit ON audit.event_id = policy.audit_event_id
        WHERE owner.id = ?1 AND owner.legacy_id <> owner.id AND policy.scope <> '*'
        ORDER BY policy.revision DESC LIMIT 1`).bind(accountId),
    )
  }

  private async read(
    statement: D1PreparedStatement,
  ): Promise<SystemAuditDisclosurePolicyEntity | null | Error> {
    try {
      const batch = await this.c.env.DB.batch<{ snapshot_json: string | null; scope: string }>([
        ...this.c.assertions,
        statement,
      ])
      if (batch.length !== this.c.assertions.length + 1 || batch.some((result) => !result.success))
        return new SystemAuditDisclosureError("unavailable")
      const row = batch.at(-1)?.results.at(0)
      if (row === undefined) return null
      if (typeof row.snapshot_json !== "string")
        return new SystemAuditDisclosureError("unavailable")
      const entity = SystemAuditDisclosurePolicyEntity.restoreJson(row.snapshot_json)
      if (entity instanceof Error) return new SystemAuditDisclosureError("unavailable", entity)
      return entity.snapshot.scope === row.scope
        ? entity
        : new SystemAuditDisclosureError("unavailable")
    } catch (cause) {
      return new SystemAuditDisclosureError("unavailable", cause)
    }
  }

  async append(
    entity: SystemAuditDisclosurePolicyEntity,
    before: SystemAuditDisclosurePolicyEntity | null,
  ): Promise<void | SystemAuditDisclosureError> {
    const statements = this.prepareRevision(entity, before)
    return statements instanceof Error
      ? statements
      : this.write([...this.c.assertions, ...statements])
  }

  async appendReplacingLegacy(
    replacement: SystemAuditDisclosurePolicyEntity,
    before: SystemAuditDisclosurePolicyEntity | null,
    retirement: SystemAuditDisclosurePolicyEntity,
    legacy: SystemAuditDisclosurePolicyEntity,
  ): Promise<void | SystemAuditDisclosureError> {
    const currentStatements = this.prepareRevision(replacement, before)
    if (currentStatements instanceof Error) return currentStatements
    const legacyStatements = this.prepareRevision(retirement, legacy)
    if (legacyStatements instanceof Error) return legacyStatements
    const mapping = this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_accounts owner WHERE owner.id = ?1 AND owner.legacy_id = ?2 AND owner.id <> ?2
        AND NOT EXISTS (SELECT 1 FROM system_accounts other WHERE other.id = ?2)
      ) THEN 1 ELSE json_extract('{}', 'audit_disclosure_legacy_mapping_changed') END AS ok`).bind(
      replacement.snapshot.scope,
      legacy.snapshot.scope,
    )
    return this.write([...this.c.assertions, mapping, ...currentStatements, ...legacyStatements])
  }

  private prepareRevision(
    entity: SystemAuditDisclosurePolicyEntity,
    before: SystemAuditDisclosurePolicyEntity | null,
  ): D1PreparedStatement[] | SystemAuditDisclosureError {
    const audit = entity.audit(before)
    if (audit instanceof Error) return new SystemAuditDisclosureError("invalid", audit)
    const value = entity.snapshot
    return [
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
  }

  private async write(
    statements: D1PreparedStatement[],
  ): Promise<void | SystemAuditDisclosureError> {
    try {
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new SystemAuditDisclosureError("unavailable")
    } catch (cause) {
      if (
        cause instanceof Error &&
        /UNIQUE constraint failed|audit_disclosure_revision_conflict|audit_disclosure_scope_unavailable|audit_disclosure_legacy_mapping_changed/.test(
          cause.message,
        )
      )
        return new SystemAuditDisclosureError("conflict", cause)
      return new SystemAuditDisclosureError("unavailable", cause)
    }
  }
}
