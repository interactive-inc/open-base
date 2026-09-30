import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { SystemAuditDisclosureValue } from "@system/domain/values/audit/system-audit-disclosure.value"
import { SystemAuditDisclosureError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { permissionKeySchema } from "@system/domain/values/iam/permission.value"

type Context = SystemD1Context
export type PreparedSystemAuditDisclosure = Readonly<{
  value: SystemAuditDisclosureValue
  assertions: ReadonlyArray<D1PreparedStatement>
}>
const authorization = `WITH grants AS (
  SELECT binding.id, binding.role_id, binding.created_at, binding.revoked_at, role.updated_at, permission.permission_key
  FROM system_role_bindings binding JOIN system_iam_roles role ON role.id = binding.role_id
  JOIN system_iam_role_permissions permission ON permission.role_id = role.id
  WHERE binding.account_id = ?1 AND binding.resource_type IS NULL AND binding.resource_id IS NULL
    AND role.resource_type IS NULL AND role.created_at <= ?3 AND binding.created_at <= ?3
    AND (binding.revoked_at IS NULL OR binding.revoked_at > ?3)
  ORDER BY binding.id, permission.permission_key
)
SELECT json_object('updatedAt', account.updated_at, 'grants', (SELECT json_group_array(json_object(
  'id', id, 'role', role_id, 'createdAt', created_at, 'revokedAt', revoked_at, 'updatedAt', updated_at, 'permission', permission_key)) FROM grants)) AS snapshot
FROM system_accounts account WHERE account.id = ?1 AND account.status = 'active' AND account.closed_at IS NULL
  AND account.token_version = ?2 AND account.created_at <= ?3
  AND EXISTS (SELECT 1 FROM grants WHERE permission_key IN (?4, 'system:admin'))`

/** 読取資格と開示条件の同じsnapshotを一覧・件数・最終監査でも要求する。 */
export class SystemAuditDisclosureReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    input: Readonly<{
      accountId: string
      tokenVersion: number
      permission: string
      purpose: string | null
      now: Date
    }>,
  ): Promise<PreparedSystemAuditDisclosure | SystemAuditDisclosureError> {
    if (
      !zAccountId.safeParse(input.accountId).success ||
      !permissionKeySchema.safeParse(input.permission).success ||
      !Number.isSafeInteger(input.tokenVersion) ||
      input.tokenVersion < 0 ||
      !Number.isSafeInteger(input.now.getTime()) ||
      input.now.getTime() < 0
    )
      return new SystemAuditDisclosureError("forbidden")
    const args = [input.accountId, input.tokenVersion, input.now.getTime(), input.permission]
    try {
      const batch = await this.c.env.DB.batch<{
        snapshot?: string
        epoch?: number
        snapshot_json?: string
      }>([
        this.c.env.DB.prepare(authorization).bind(...args),
        this.c.env.DB.prepare(
          // 版は削除も更新もできないため、行数が増えたかどうかで変更を検知する。
          "SELECT count(*) AS epoch FROM system_audit_disclosure_policy_revisions",
        ),
        this.c.env.DB.prepare(`SELECT audit.after_json AS snapshot_json FROM system_audit_disclosure_policy_revisions policy
          JOIN system_audit_events audit ON audit.event_id = policy.audit_event_id
          WHERE policy.scope IN ('*', ?1) AND policy.revision = (SELECT MAX(revision) FROM system_audit_disclosure_policy_revisions latest WHERE latest.scope = policy.scope)`).bind(
          input.accountId,
        ),
      ])
      if (batch.length !== 3 || batch.some((result) => !result.success))
        return new SystemAuditDisclosureError("unavailable")
      const actor = batch[0]?.results.at(0)?.snapshot
      if (actor === undefined) return new SystemAuditDisclosureError("forbidden")
      const epoch = batch[1]?.results.at(0)?.epoch
      if (typeof epoch !== "number" || !Number.isSafeInteger(epoch) || epoch < 0)
        return new SystemAuditDisclosureError("unavailable")
      const policies: SystemAuditDisclosurePolicyEntity[] = []
      for (const row of batch[2]?.results ?? []) {
        if (typeof row.snapshot_json !== "string")
          return new SystemAuditDisclosureError("unavailable")
        const policy = SystemAuditDisclosurePolicyEntity.create(JSON.parse(row.snapshot_json))
        if (policy instanceof Error) return new SystemAuditDisclosureError("unavailable", policy)
        policies.push(policy)
      }
      const value = SystemAuditDisclosureValue.evaluate({
        policies,
        accountId: input.accountId,
        purpose: input.purpose,
        at: input.now,
      })
      if (value instanceof Error) return value
      return Object.freeze({
        value,
        assertions: Object.freeze([
          this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (SELECT 1 FROM (${authorization}) actor WHERE actor.snapshot = ?5)
          THEN 1 ELSE json_extract('{}', 'system_audit_read_authorization_changed') END AS ok`).bind(
            ...args,
            actor,
          ),
          this.c.env.DB.prepare(`SELECT CASE WHEN count(*) = ?1 THEN 1
          ELSE json_extract('{}', 'system_audit_disclosure_changed') END AS ok FROM system_audit_disclosure_policy_revisions`).bind(
            epoch,
          ),
        ]),
      })
    } catch (cause) {
      return new SystemAuditDisclosureError("unavailable", cause)
    }
  }
}
