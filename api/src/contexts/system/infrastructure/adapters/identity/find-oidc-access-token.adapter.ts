import { hashOidcSecret } from "@system/application/auth/identity/lib/hash-oidc-secret"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { systemOidcAccessTokens } from "@system/infrastructure/schema/system-core"
import { and, eq, gt, lte, sql } from "drizzle-orm"

type Props = Readonly<{ issuer: string; accessToken: string }>

type OidcAccessToken = Readonly<{
  clientId: string
  accountId: AccountId
  tokenVersion: number
  scope: string
}>
type Context = SystemDatabaseContext & SystemClockContext

/** issuerと有効期限に束縛したOIDC access tokenをhashで検索する。 */
export class FindOidcAccessTokenAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findOidcAccessToken(props: Props): Promise<OidcAccessToken | null | Error> {
    const now = this.c.var.now()
    const tokenHash = await hashOidcSecret(props.accessToken)

    try {
      const tokens = await this.c.var.database
        .select({
          clientId: systemOidcAccessTokens.clientId,
          accountId: systemOidcAccessTokens.accountId,
          tokenVersion: systemOidcAccessTokens.tokenVersion,
          scope: systemOidcAccessTokens.scope,
        })
        .from(systemOidcAccessTokens)
        .where(
          and(
            eq(systemOidcAccessTokens.tokenHash, tokenHash),
            eq(systemOidcAccessTokens.issuer, props.issuer),
            gt(systemOidcAccessTokens.expiresAt, now),
            lte(systemOidcAccessTokens.createdAt, now),
            sql`EXISTS (SELECT 1 FROM system_accounts WHERE id=system_oidc_access_tokens.account_id
              AND status='active' AND closed_at IS NULL AND token_version=system_oidc_access_tokens.token_version)`,
          ),
        )
        .limit(1)

      const row = tokens.at(0)
      if (row === undefined) return null
      return Number.isSafeInteger(row.tokenVersion) && row.tokenVersion >= 0
        ? row
        : new Error("OIDC token state is invalid")
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("access token read failed")
    }
  }
}
