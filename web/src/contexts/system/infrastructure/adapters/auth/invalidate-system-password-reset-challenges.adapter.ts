import type { SystemDatabase } from "@system/configuration/system-context"
import { systemPasswordResetChallenges } from "@system/infrastructure/schema/system-core"
import { and, eq, isNull, sql } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"

export type InvalidateSystemPasswordResetChallengesInput = Readonly<{
  accountId: string
  /** 本人の変更は変更したIdentity、管理者の復旧は有効なIdentity全件を対象にする。 */
  identityId: string | undefined
  now: Date
}>

type Context = SystemDatabase | D1Database

/** 未有効化Identityの設定リンクは保ち、変更した資格の再設定リンクを同じ保存単位で失効させる。 */
export class InvalidateSystemPasswordResetChallengesAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(input: InvalidateSystemPasswordResetChallengesInput) {
    const database = "update" in this.c ? this.c : drizzle(this.c)
    return database
      .update(systemPasswordResetChallenges)
      .set({ usedAt: sql`max(${systemPasswordResetChallenges.createdAt}, ${input.now.getTime()})` })
      .where(
        and(
          eq(systemPasswordResetChallenges.accountId, input.accountId),
          isNull(systemPasswordResetChallenges.usedAt),
          input.identityId === undefined
            ? undefined
            : eq(systemPasswordResetChallenges.identityId, input.identityId),
          sql`EXISTS (SELECT 1 FROM system_identity_bindings binding
          WHERE binding.id = ${systemPasswordResetChallenges.identityId}
            AND binding.account_id = ${input.accountId}
            AND binding.provider = 'password'
            AND binding.activated_at IS NOT NULL AND binding.revoked_at IS NULL)`,
        ),
      )
  }
}
