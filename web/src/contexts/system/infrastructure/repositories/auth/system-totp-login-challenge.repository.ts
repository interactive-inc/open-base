import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemTotpLoginChallengeEntity } from "@system/domain/entities/system-totp-login-challenge.entity"

type Context = SystemD1Context

type ChallengeRow = Readonly<{
  account_id: string
  token_version: number
  failed_attempts: number
  created_at: number
  expires_at: number
}>

const ABORT_WHEN_NO_ROWS_CHANGED =
  "SELECT CASE WHEN changes() = 0 THEN json_extract('', '$') ELSE 1 END"

/** パスワードを確かめた後の 2 段目を待つ challenge。raw の値は保存せず、hash だけで引く。 */
export class SystemTotpLoginChallengeRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** challenge を保存する。同じ Account の期限切れの challenge はこのときに掃除する。 */
  async create(challenge: SystemTotpLoginChallengeEntity): Promise<null | Error> {
    try {
      const database = this.c.env.DB
      await database.batch([
        database
          .prepare(
            "DELETE FROM system_totp_login_challenges WHERE account_id = ?1 AND expires_at <= ?2",
          )
          .bind(challenge.accountId, challenge.createdAt.getTime()),
        database
          .prepare(
            `INSERT INTO system_totp_login_challenges
               (challenge_hash, account_id, token_version, failed_attempts, created_at, expires_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
          )
          .bind(
            challenge.challengeHash,
            challenge.accountId,
            challenge.tokenVersion,
            challenge.failedAttempts,
            challenge.createdAt.getTime(),
            challenge.expiresAt.getTime(),
          ),
      ])

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to create TOTP login challenge")
    }
  }

  async find(challengeHash: string): Promise<SystemTotpLoginChallengeEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT account_id, token_version, failed_attempts, created_at, expires_at
         FROM system_totp_login_challenges WHERE challenge_hash = ?1`,
      )
        .bind(challengeHash)
        .first<ChallengeRow>()
      if (row === null) return null

      return SystemTotpLoginChallengeEntity.create({
        challengeHash,
        accountId: row.account_id,
        tokenVersion: row.token_version,
        failedAttempts: row.failed_attempts,
        createdAt: new Date(row.created_at),
        expiresAt: new Date(row.expires_at),
      })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read TOTP login challenge")
    }
  }

  /** 誤ったコードを数える。上限に達した challenge は消し、パスワードからやり直させる。 */
  async recordFailure(
    challenge: SystemTotpLoginChallengeEntity,
    auditStatements: ReadonlyArray<D1PreparedStatement>,
  ): Promise<null | Error> {
    try {
      const database = this.c.env.DB
      await database.batch([
        database
          .prepare(
            `UPDATE system_totp_login_challenges
             SET failed_attempts = failed_attempts + 1
             WHERE challenge_hash = ?1`,
          )
          .bind(challenge.challengeHash),
        database
          .prepare(
            `DELETE FROM system_totp_login_challenges
             WHERE challenge_hash = ?1 AND failed_attempts >= ?2`,
          )
          .bind(challenge.challengeHash, SystemTotpLoginChallengeEntity.MAX_FAILED_ATTEMPTS),
        ...auditStatements,
      ])

      return null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to record TOTP login failure")
    }
  }

  /**
   * challenge を一度だけ消費する文。期限内で、Account の失効世代が発行時から変わっていない
   * ときだけ消し、消せなければ batch ごと取り消す。
   */
  prepareConsume(
    challenge: SystemTotpLoginChallengeEntity,
    now: Date,
  ): ReadonlyArray<D1PreparedStatement> {
    const database = this.c.env.DB

    return [
      database
        .prepare(
          `DELETE FROM system_totp_login_challenges
           WHERE challenge_hash = ?1 AND expires_at > ?2
             AND EXISTS (
               SELECT 1 FROM system_accounts account
               WHERE account.id = system_totp_login_challenges.account_id
                 AND account.token_version = system_totp_login_challenges.token_version
                 AND account.status = 'active' AND account.closed_at IS NULL
             )`,
        )
        .bind(challenge.challengeHash, now.getTime()),
      database.prepare(ABORT_WHEN_NO_ROWS_CHANGED),
    ]
  }
}
