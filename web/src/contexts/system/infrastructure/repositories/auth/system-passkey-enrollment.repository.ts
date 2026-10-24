import type { SystemD1Context } from "@system/configuration/system-context"
import { zAccountId, type AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zIdentityId, type IdentityId } from "@system/domain/schemas/identity/identity-id.schema"

export type SystemPasskeyEnrollmentReason = "bootstrap" | "provisioning" | "reissue" | "recovery"

export type SystemPasskeyEnrollmentTarget = Readonly<{
  accountId: AccountId
  identityId: IdentityId
  email: string
}>

export type SystemPasskeyEnrollmentIssue = Readonly<{
  id: string
  accountId: AccountId
  identityId: IdentityId
  tokenHash: string
  reason: SystemPasskeyEnrollmentReason
  issuedByAccountId: AccountId | null
  createdAt: Date
  expiresAt: Date
}>

type TargetRow = Readonly<{ account_id: string; identity_id: string; email: string | null }>

const ABORT_UNLESS_ONE_CHANGED =
  "SELECT CASE WHEN changes() = 1 THEN 1 ELSE json_extract('', '$') END AS ok"

/**
 * パスキー招待をtokenのhashだけで保存する。
 * 1つのAccountで使える招待は常に1件で、発行すると未使用の招待を失効させる。
 * 使うときは招待の消費とIdentityの有効化を同じbatchで行い、どちらかが失敗すれば両方戻す。
 */
export class SystemPasskeyEnrollmentRepository {
  constructor(private readonly c: SystemD1Context) {
    Object.freeze(this)
  }

  /** 発行用の文。呼び出し側がAccountやIdentityの作成と同じbatchへ載せる。 */
  prepareIssue(issue: SystemPasskeyEnrollmentIssue): ReadonlyArray<D1PreparedStatement> {
    const database = this.c.env.DB
    return [
      database
        .prepare(
          `UPDATE system_passkey_enrollments
           SET revoked_at = ?2
           WHERE account_id = ?1 AND consumed_at IS NULL AND revoked_at IS NULL
             AND created_at <= ?2`,
        )
        .bind(issue.accountId, issue.createdAt.getTime()),
      database
        .prepare(
          `INSERT INTO system_passkey_enrollments
             (id, account_id, identity_id, token_hash, reason, issued_by_account_id,
              created_at, expires_at, consumed_at, revoked_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, NULL, NULL)`,
        )
        .bind(
          issue.id,
          issue.accountId,
          issue.identityId,
          issue.tokenHash,
          issue.reason,
          issue.issuedByAccountId,
          issue.createdAt.getTime(),
          issue.expiresAt.getTime(),
        ),
    ]
  }

  /** 招待の対象にできる、有効なAccountのパスキーIdentityを返す。 */
  async findTarget(accountId: AccountId): Promise<SystemPasskeyEnrollmentTarget | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT identity.account_id, identity.id AS identity_id, profile.email
         FROM system_identity_bindings identity
         INNER JOIN system_accounts account
           ON account.id = identity.account_id
          AND account.status = 'active' AND account.closed_at IS NULL
         INNER JOIN system_identity_profiles profile ON profile.identity_id = identity.id
         WHERE identity.account_id = ?1 AND identity.provider = 'passkey'
           AND identity.revoked_at IS NULL
         LIMIT 1`,
      )
        .bind(accountId)
        .first<TargetRow>()
      return row === null ? null : toTarget(row)
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to read passkey enrollment target")
    }
  }

  /** 使える招待の対象を返す。期限切れ、使用済み、失効済み、Accountが無効なら null。 */
  async findUsable(
    tokenHash: string,
    now: Date,
  ): Promise<SystemPasskeyEnrollmentTarget | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT enrollment.account_id, enrollment.identity_id, profile.email
         FROM system_passkey_enrollments enrollment
         INNER JOIN system_accounts account
           ON account.id = enrollment.account_id
          AND account.status = 'active' AND account.closed_at IS NULL
         INNER JOIN system_identity_bindings identity
           ON identity.id = enrollment.identity_id
          AND identity.account_id = enrollment.account_id
          AND identity.provider = 'passkey' AND identity.revoked_at IS NULL
         INNER JOIN system_identity_profiles profile ON profile.identity_id = identity.id
         WHERE enrollment.token_hash = ?1
           AND enrollment.consumed_at IS NULL AND enrollment.revoked_at IS NULL
           AND enrollment.created_at <= ?2 AND enrollment.expires_at > ?2
         LIMIT 1`,
      )
        .bind(tokenHash, now.getTime())
        .first<TargetRow>()
      return row === null ? null : toTarget(row)
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read passkey enrollment")
    }
  }

  /**
   * 招待を一度だけ消費し、まだ有効化していないIdentityを有効化する。
   * 同時に使われた招待は片方だけが成功し、もう片方は null を返す。
   */
  async consume(
    tokenHash: string,
    now: Date,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<"consumed" | null | Error> {
    const database = this.c.env.DB
    const statements = [
      database
        .prepare(
          `UPDATE system_passkey_enrollments
           SET consumed_at = ?2
           WHERE token_hash = ?1
             AND consumed_at IS NULL AND revoked_at IS NULL
             AND created_at <= ?2 AND expires_at > ?2`,
        )
        .bind(tokenHash, now.getTime()),
      database.prepare(ABORT_UNLESS_ONE_CHANGED),
      database
        .prepare(
          `UPDATE system_identity_bindings
           SET activated_at = ?2
           WHERE id = (SELECT identity_id FROM system_passkey_enrollments WHERE token_hash = ?1)
             AND activated_at IS NULL AND revoked_at IS NULL`,
        )
        .bind(tokenHash, now.getTime()),
      ...auditStatements,
    ]
    try {
      const results = await database.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success)) {
        return new Error("passkey enrollment batch did not succeed")
      }
      return "consumed"
    } catch (caught) {
      const stillUsable = await this.findUsable(tokenHash, now)
      if (stillUsable === null) return null
      return caught instanceof Error ? caught : new Error("failed to consume passkey enrollment")
    }
  }
}

function toTarget(row: TargetRow): SystemPasskeyEnrollmentTarget | Error {
  const accountId = zAccountId.safeParse(row.account_id)
  const identityId = zIdentityId.safeParse(row.identity_id)
  if (!accountId.success || !identityId.success || row.email === null) {
    return new Error("passkey enrollment row is invalid")
  }
  return Object.freeze({ accountId: accountId.data, identityId: identityId.data, email: row.email })
}
