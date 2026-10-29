import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

type Context = Readonly<{ database: D1Database }>
type Attempt = Readonly<{ accountId: AccountId; ip: string | null; now: Date }>

/** 再認証の試行を原子的に記録し、記録不能な場合はErrorで閉じる。 */
export class StepUpRateLimitAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async recordAndCheck(input: Attempt): Promise<boolean | Error> {
    const ip = input.ip ?? "anonymous"
    if (ip.length === 0 || ip.length > 255 || ip.includes("\u0000")) return true
    if (!Number.isSafeInteger(input.now.getTime()))
      return new Error("step-up attempt time is invalid")

    try {
      const outcomes = await this.c.database.batch([
        this.c.database
          .prepare(
            "DELETE FROM system_authentication_attempts WHERE identifier = ?1 AND attempted_at <= ?2",
          )
          .bind(`step-up:${input.accountId}`, input.now.getTime() - 900_000),
        this.prepareAttempt(input, ip),
      ])
      if (outcomes.length !== 2 || outcomes.some((outcome) => !outcome.success))
        return new Error("step-up attempt recording failed")

      return outcomes[1]?.meta.changes !== 1
    } catch {
      return new Error("step-up attempt recording failed")
    }
  }

  async reset(accountId: AccountId): Promise<void | Error> {
    try {
      const outcome = await this.c.database
        .prepare("DELETE FROM system_authentication_attempts WHERE identifier = ?1")
        .bind(`step-up:${accountId}`)
        .run()

      if (!outcome.success) return new Error("step-up attempts could not be reset")
    } catch {
      return new Error("step-up attempts could not be reset")
    }
  }

  private prepareAttempt(input: Attempt, ip: string): D1PreparedStatement {
    return this.c.database
      .prepare(`
      INSERT INTO system_authentication_attempts (id, identifier, ip, attempted_at)
      SELECT ?1, ?2, ?3, ?4
      WHERE (SELECT count(*) FROM system_authentication_attempts
        WHERE identifier = ?2 AND ip = ?3 AND attempted_at > ?5) < 10
      AND (SELECT count(*) FROM system_authentication_attempts
        WHERE identifier = ?2 AND attempted_at > ?5) < 20
      AND (SELECT count(*) FROM system_authentication_attempts
        WHERE identifier LIKE 'step-up:%' AND ip = ?3 AND attempted_at > ?5) < 50
    `)
      .bind(
        crypto.randomUUID(),
        `step-up:${input.accountId}`,
        ip,
        input.now.getTime(),
        input.now.getTime() - 900_000,
      )
  }
}
