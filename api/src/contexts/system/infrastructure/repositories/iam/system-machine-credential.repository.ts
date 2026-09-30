import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemMachineCredentialEntity } from "@system/domain/entities/system-machine-credential.entity"

type CredentialRow = Readonly<{
  id: string
  principal_id: string
  name: string
  secret_hash: string
  status: unknown
  created_at: number
  updated_at: number
  expires_at: number | null
  last_used_at: number | null
  revoked_at: number | null
}>

type AuthenticationRow = CredentialRow &
  Readonly<{
    account_id: string
    token_version: number
    account_status: string
    principal_kind: string
    connector_status: string | null
  }>

export type SystemMachineAuthentication =
  | Readonly<{
      kind: "authenticated"
      accountId: AccountId
      tokenVersion: number
      credentialId: string
    }>
  | Readonly<{ kind: "rejected" }>

type Context = SystemD1Context

/** raw secretを保存せず、機械Principalのcredential lifecycleを原子的に保存する。 */
export class SystemMachineCredentialRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findMany(
    principalId: string,
  ): Promise<ReadonlyArray<SystemMachineCredentialEntity> | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `SELECT id, principal_id, name, secret_hash, status, created_at, updated_at,
                expires_at, last_used_at, revoked_at
         FROM system_machine_credentials
         WHERE principal_id = ?1
         ORDER BY created_at, id`,
      )
        .bind(principalId)
        .all<CredentialRow>()
      if (!result.success) return new Error("failed to list System machine credentials")

      const credentials: Array<SystemMachineCredentialEntity> = []
      for (const row of result.results) {
        const credential = this.restore(row)
        if (credential instanceof Error) return credential
        credentials.push(credential)
      }
      return Object.freeze(credentials)
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to list System machine credentials")
    }
  }

  async create(
    credential: SystemMachineCredentialEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"created" | "conflict" | Error> {
    try {
      const statements = [
        this.c.env.DB.prepare(
          `INSERT INTO system_machine_credentials
             (id, principal_id, name, secret_hash, status, created_at, updated_at,
              expires_at, last_used_at, revoked_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
        ).bind(
          credential.id,
          credential.principalId,
          credential.name,
          credential.secretHash,
          credential.status,
          credential.createdAt.getTime(),
          credential.updatedAt.getTime(),
          credential.expiresAt?.getTime() ?? null,
          credential.lastUsedAt?.getTime() ?? null,
          credential.revokedAt?.getTime() ?? null,
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System machine credential creation batch did not succeed")
      }
      return "created"
    } catch (caught) {
      if (caught instanceof Error && caught.message.toLowerCase().includes("unique")) {
        return "conflict"
      }
      return caught instanceof Error
        ? caught
        : new Error("failed to create System machine credential")
    }
  }

  async authenticate(
    credentialId: string,
    secretHash: string,
    now: Date,
    prepareAuditStatements: (accountId: AccountId) => ReadonlyArray<D1PreparedStatement> | Error,
  ): Promise<SystemMachineAuthentication | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT credential.id, credential.principal_id, credential.name, credential.secret_hash,
                credential.status, credential.created_at, credential.updated_at,
                credential.expires_at, credential.last_used_at, credential.revoked_at,
                principal.account_id, principal.kind AS principal_kind,
                connector.status AS connector_status,
                account.token_version, account.status AS account_status
         FROM system_machine_credentials AS credential
         INNER JOIN system_principals AS principal ON principal.id = credential.principal_id
         INNER JOIN system_accounts AS account ON account.id = principal.account_id
         LEFT JOIN system_connectors AS connector ON connector.id = principal.connector_id
         WHERE credential.id = ?1 AND credential.secret_hash = ?2
         LIMIT 1`,
      )
        .bind(credentialId, secretHash)
        .first<AuthenticationRow>()
      if (
        row === null ||
        row.account_status !== "active" ||
        !["agent", "service", "connector"].includes(row.principal_kind) ||
        !Number.isSafeInteger(row.token_version) ||
        row.token_version < 0 ||
        (row.principal_kind === "connector" && row.connector_status !== "active")
      ) {
        return Object.freeze({ kind: "rejected" as const })
      }
      const accountId = zAccountId.safeParse(row.account_id)
      if (!accountId.success) return new Error("System machine Account ID is invalid")
      const credential = this.restore(row)
      if (credential instanceof Error) return credential
      const used = credential.recordUse(now)
      if (used instanceof Error) return Object.freeze({ kind: "rejected" as const })
      const auditStatements = prepareAuditStatements(accountId.data)
      if (auditStatements instanceof Error) return auditStatements

      const statements = [
        this.c.env.DB.prepare(
          `UPDATE system_machine_credentials
           SET updated_at = ?2, last_used_at = ?2
           WHERE id = ?1 AND status = 'active' AND updated_at = ?3
             AND created_at <= ?2 AND (expires_at IS NULL OR expires_at > ?2)
             AND EXISTS (
               SELECT 1 FROM system_principals AS principal
               INNER JOIN system_accounts AS account ON account.id = principal.account_id
               LEFT JOIN system_connectors AS connector ON connector.id = principal.connector_id
               WHERE principal.id = system_machine_credentials.principal_id
                 AND principal.account_id = ?4 AND account.status = 'active'
                 AND account.token_version = ?5
                 AND principal.kind IN ('agent', 'service', 'connector')
                 AND (principal.kind <> 'connector' OR connector.status = 'active')
             )`,
        ).bind(
          credential.id,
          now.getTime(),
          credential.updatedAt.getTime(),
          accountId.data,
          row.token_version,
        ),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System machine authentication batch did not succeed")
      }
      return Object.freeze({
        kind: "authenticated" as const,
        accountId: accountId.data,
        tokenVersion: row.token_version,
        credentialId: credential.id,
      })
    } catch (caught) {
      if (caught instanceof Error && caught.message.includes("integer overflow")) {
        return Object.freeze({ kind: "rejected" as const })
      }
      return caught instanceof Error ? caught : new Error("failed to authenticate System machine")
    }
  }

  async revoke(
    principalId: string,
    credentialId: string,
    now: Date,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"revoked" | "unchanged" | "not_found" | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT id, principal_id, name, secret_hash, status, created_at, updated_at,
                expires_at, last_used_at, revoked_at
         FROM system_machine_credentials
         WHERE id = ?1 AND principal_id = ?2
         LIMIT 1`,
      )
        .bind(credentialId, principalId)
        .first<CredentialRow>()
      if (row === null) return "not_found"
      const credential = this.restore(row)
      if (credential instanceof Error) return credential
      const revoked = credential.revoke(now)
      if (revoked instanceof Error) return revoked
      if (revoked === credential) return "unchanged"

      const statements = [
        this.c.env.DB.prepare(
          `UPDATE system_machine_credentials
           SET status = 'revoked', updated_at = ?2, revoked_at = ?2
           WHERE id = ?1 AND status = 'active' AND updated_at = ?3`,
        ).bind(credential.id, now.getTime(), credential.updatedAt.getTime()),
        this.c.env.DB.prepare(
          "SELECT CASE WHEN changes() = 1 THEN 1 ELSE abs(-9223372036854775808) END AS ok",
        ),
        ...auditStatements,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("System machine credential revocation batch did not succeed")
      }
      return "revoked"
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to revoke System machine credential")
    }
  }

  private restore(row: CredentialRow): SystemMachineCredentialEntity | Error {
    return SystemMachineCredentialEntity.create({
      id: row.id,
      principalId: row.principal_id,
      name: row.name,
      secretHash: row.secret_hash,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: row.expires_at === null ? null : new Date(row.expires_at),
      lastUsedAt: row.last_used_at === null ? null : new Date(row.last_used_at),
      revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
    })
  }
}
