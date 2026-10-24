import type { SystemD1Context } from "@system/configuration/system-context"
type Context = SystemD1Context

/** 外部Identity tokenのjtiを原子的に記録してreplayを検知する。 */
export class RecordSystemIdentityLoginTokenAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async recordSystemIdentityLoginToken(
    input: Readonly<{ jti: string; expiresAt: Date; usedAt: Date }>,
  ): Promise<"recorded" | "replayed" | Error> {
    try {
      const result = await this.c.env.DB.prepare(
        `INSERT INTO system_identity_login_tokens (jti, expires_at, used_at)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(jti) DO NOTHING`,
      )
        .bind(input.jti, input.expiresAt.getTime(), input.usedAt.getTime())
        .run()
      return result.meta.changes > 0 ? "recorded" : "replayed"
    } catch (caught) {
      return caught instanceof Error
        ? caught
        : new Error("failed to record System identity login token")
    }
  }
}
