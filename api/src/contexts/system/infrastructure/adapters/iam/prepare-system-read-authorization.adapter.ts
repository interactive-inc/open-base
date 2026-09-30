import type { SystemD1Context } from "@system/configuration/system-context"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"
import { z } from "zod"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"

type Context = SystemD1Context

const snapshotSchema = z.object({ proof: z.string(), permissions: z.string() })
const permissionsSchema = z.array(z.string().min(1))
const authorizationSql = `WITH evaluation AS (
  SELECT max(?7, CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) AS at
), grants AS (
  SELECT binding.id, binding.role_id, binding.resource_type, binding.resource_id,
    binding.created_at, binding.revoked_at, role.key, role.kind, role.resource_type AS role_resource_type,
    role.created_at AS role_created_at, role.updated_at, permission.permission_key
  FROM system_role_bindings binding JOIN system_iam_roles role ON role.id = binding.role_id
  LEFT JOIN system_iam_role_permissions permission ON permission.role_id = role.id
  WHERE binding.account_id = ?1 AND binding.created_at <= (SELECT at FROM evaluation)
    AND role.created_at <= (SELECT at FROM evaluation)
    AND (binding.revoked_at IS NULL OR (SELECT at FROM evaluation) < binding.revoked_at)
  ORDER BY binding.id, permission.permission_key
)
SELECT json_array(account.updated_at, principal.id, principal.kind, principal.revision,
  principal.created_at, principal.updated_at, principal.connector_id,
  credential.id, credential.updated_at, credential.last_used_at, credential.expires_at,
  identity.id, identity.provider, identity.subject, identity.created_at, identity.activated_at,
  connector.id, connector.revision,
  (SELECT json_group_array(json_array(id,role_id,resource_type,resource_id,created_at,revoked_at,
    key,kind,role_resource_type,role_created_at,updated_at,permission_key)) FROM grants)) AS proof,
  (SELECT json_group_array(permission_key) FROM grants WHERE resource_type IS NULL AND resource_id IS NULL
    AND role_resource_type IS NULL AND permission_key IS NOT NULL) AS permissions
FROM system_accounts account
LEFT JOIN system_principals principal ON principal.account_id = account.id
LEFT JOIN system_machine_credentials credential ON credential.principal_id = principal.id AND credential.id = ?5
LEFT JOIN system_connectors connector ON connector.id = principal.connector_id
LEFT JOIN system_identity_bindings identity ON identity.account_id = account.id AND identity.id = ?6
WHERE account.id = ?1 AND account.status = 'active' AND account.closed_at IS NULL AND account.token_version = ?2
  AND account.created_at <= (SELECT at FROM evaluation) AND ?3 <= (SELECT at FROM evaluation) AND (SELECT at FROM evaluation) < ?4
  AND (principal.id IS NULL OR principal.created_at <= (SELECT at FROM evaluation))
  AND ((?5 IS NULL AND (principal.id IS NULL OR principal.kind = 'human'))
    OR (?5 IS NOT NULL AND principal.kind IN ('agent','service','connector') AND credential.status = 'active'
      AND credential.revoked_at IS NULL AND credential.created_at <= ?3 AND credential.last_used_at >= ?3
      AND credential.last_used_at <= (SELECT at FROM evaluation)
      AND (credential.expires_at IS NULL OR (credential.expires_at > ?3 AND credential.expires_at > (SELECT at FROM evaluation)))
      AND (principal.kind <> 'connector' OR connector.status = 'active')))
  AND (?6 IS NULL OR (identity.id IS NOT NULL AND identity.created_at <= (SELECT at FROM evaluation)
    AND identity.activated_at IS NOT NULL AND identity.activated_at <= (SELECT at FROM evaluation) AND identity.revoked_at IS NULL))`

/** 現在のBearer発行元と権限を読み、開示監査の前後でも同じ資格と期限を要求する。 */
export class PrepareSystemReadAuthorizationAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(authentication: SystemReadAuthentication, at: Date) {
    if (
      !Number.isSafeInteger(at.getTime()) ||
      at.getTime() < 0 ||
      !Number.isSafeInteger(authentication.tokenVersion) ||
      authentication.tokenVersion < 0 ||
      !Number.isSafeInteger(authentication.issuedAtMs) ||
      authentication.issuedAtMs < 0 ||
      !Number.isSafeInteger(authentication.expiresAtMs) ||
      authentication.expiresAtMs <= authentication.issuedAtMs
    )
      return new Error("read authentication is invalid")
    const parameters = (now: Date) => [
      authentication.accountId,
      authentication.tokenVersion,
      authentication.issuedAtMs,
      authentication.expiresAtMs,
      authentication.machineCredentialId,
      authentication.identityBindingId,
      now.getTime(),
    ]
    try {
      // 発行元の照合と付与の読取を同じ batch で読み、往復を 1 回にする。
      const authorization = new SystemD1AuthorizationAdapter(this.c)
      const [current, grants] = await this.c.env.DB.batch<Record<string, unknown>>([
        this.c.env.DB.prepare(authorizationSql).bind(...parameters(at)),
        authorization.statementForAccount(authentication.accountId),
      ])
      const row = current?.results[0]
      if (row === undefined) return null
      const snapshot = snapshotSchema.parse(row)
      const permissions = permissionsSchema.parse(JSON.parse(snapshot.permissions))
      const canonical = authorization.resolveGraph(authorization.restoreForAccount(grants), {
        resource: null,
        at: new Date(Math.max(at.getTime(), Date.now())),
      })
      if (canonical === null || canonical instanceof Error) return canonical
      const keys = new Set(permissions)
      if (
        canonical.permissionKeys.size !== keys.size ||
        [...canonical.permissionKeys].some((key) => !keys.has(key))
      )
        return null
      return {
        permissionKeys: keys,
        assertions: (now: Date): ReadonlyArray<D1PreparedStatement> | Error => {
          if (!Number.isSafeInteger(now.getTime()) || now.getTime() < at.getTime())
            return new Error("read authorization time changed")
          return [
            this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (
            SELECT 1 FROM (${authorizationSql}) current WHERE current.proof = ?8 AND current.permissions = ?9
          ) THEN 1 ELSE json_extract('{}','system_read_authorization_changed') END`).bind(
              ...parameters(now),
              snapshot.proof,
              snapshot.permissions,
            ),
          ]
        },
      }
    } catch (cause) {
      return new Error("read authorization unavailable", { cause })
    }
  }
}
