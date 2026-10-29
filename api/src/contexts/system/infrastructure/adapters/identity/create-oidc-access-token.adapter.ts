import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { oidcAccessTokenLifetime } from "@system/domain/values/oauth/oidc-token-lifetime.value"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { createOidcSecret } from "@system/application/auth/identity/lib/create-oidc-secret"
import { hashOidcSecret } from "@system/application/auth/identity/lib/hash-oidc-secret"
import { systemOidcAccessTokens } from "@system/infrastructure/schema/system-core"
import { lte, sql } from "drizzle-orm"

type Props = Readonly<{
  issuer: string
  clientId: string
  accountId: AccountId
  tokenVersion: number
  scope: string
}>
type Context = SystemDatabaseContext & SystemClockContext

/** 平文を保存しない短命OIDC access tokenを発行する。 */
export class CreateOidcAccessTokenAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async createOidcAccessToken(
    props: Props,
  ): Promise<Readonly<{ accessToken: string; expiresAt: Date }> | Error> {
    const now = this.c.var.now()
    const expiresAt = new Date(now.getTime() + oidcAccessTokenLifetime.milliseconds)
    const accessToken = createOidcSecret()
    const tokenHash = await hashOidcSecret(accessToken)

    try {
      await this.c.var.database
        .delete(systemOidcAccessTokens)
        .where(lte(systemOidcAccessTokens.expiresAt, now))
      const stored = await this.c.var.database
        .insert(systemOidcAccessTokens)
        .values({
          tokenHash,
          issuer: props.issuer,
          clientId: props.clientId,
          accountId: props.accountId,
          scope: props.scope,
          tokenVersion: sql`(SELECT token_version FROM system_accounts
          WHERE id=${props.accountId} AND token_version=${props.tokenVersion}
            AND status='active' AND closed_at IS NULL AND created_at<=${now.getTime()})`,
          expiresAt,
          createdAt: now,
        })
        .returning({ hash: systemOidcAccessTokens.tokenHash })
      if (stored.length !== 1) return new Error("OIDC authentication changed")

      return Object.freeze({ accessToken, expiresAt })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("access token write failed")
    }
  }
}
