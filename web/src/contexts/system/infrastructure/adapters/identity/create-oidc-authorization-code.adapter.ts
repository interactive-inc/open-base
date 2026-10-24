import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { oidcAuthorizationCodeLifetime } from "@system/domain/values/oauth/oidc-token-lifetime.value"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { createOidcSecret } from "@system/application/auth/identity/lib/create-oidc-secret"
import { hashOidcSecret } from "@system/application/auth/identity/lib/hash-oidc-secret"
import { systemOidcAuthorizationCodes } from "@system/infrastructure/schema/system-core"
import { lte } from "drizzle-orm"

type Props = Readonly<{
  issuer: string
  clientId: string
  redirectUri: string
  accountId: AccountId
  codeChallenge: string
  nonce: string
  scope: ReadonlyArray<string>
}>
type Context = SystemDatabaseContext & SystemClockContext

/** hashだけを保存する短命OIDC authorization codeを発行する。 */
export class CreateOidcAuthorizationCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async createOidcAuthorizationCode(
    props: Props,
  ): Promise<Readonly<{ code: string; expiresAt: Date }> | Error> {
    const now = this.c.var.now()
    const expiresAt = new Date(now.getTime() + oidcAuthorizationCodeLifetime.milliseconds)
    const code = createOidcSecret()
    const codeHash = await hashOidcSecret(code)

    try {
      await this.c.var.database
        .delete(systemOidcAuthorizationCodes)
        .where(lte(systemOidcAuthorizationCodes.expiresAt, now))
      await this.c.var.database.insert(systemOidcAuthorizationCodes).values({
        codeHash,
        issuer: props.issuer,
        clientId: props.clientId,
        redirectUri: props.redirectUri,
        accountId: props.accountId,
        codeChallenge: props.codeChallenge,
        nonce: props.nonce,
        scope: props.scope.join(" "),
        expiresAt,
        createdAt: now,
      })

      return Object.freeze({ code, expiresAt })
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("authorization code write failed")
    }
  }
}
