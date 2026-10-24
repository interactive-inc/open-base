import { hashOidcSecret } from "@system/application/auth/identity/lib/hash-oidc-secret"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { systemOidcAccessTokens } from "@system/infrastructure/schema/system-core"
import { and, eq, gt } from "drizzle-orm"

type Props = Readonly<{ issuer: string; accessToken: string }>

type OidcAccessToken = Readonly<{
  clientId: string
  accountId: AccountId
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
          scope: systemOidcAccessTokens.scope,
        })
        .from(systemOidcAccessTokens)
        .where(
          and(
            eq(systemOidcAccessTokens.tokenHash, tokenHash),
            eq(systemOidcAccessTokens.issuer, props.issuer),
            gt(systemOidcAccessTokens.expiresAt, now),
          ),
        )
        .limit(1)

      return tokens.at(0) ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("access token read failed")
    }
  }
}
