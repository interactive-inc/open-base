import { toPkceS256Challenge } from "@system/lib/auth/to-pkce-s256-challenge"
import { hashOidcSecret } from "@system/application/auth/identity/lib/hash-oidc-secret"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { systemOidcAuthorizationCodes } from "@system/infrastructure/schema/system-core"
import { and, eq, gt } from "drizzle-orm"

type Props = Readonly<{
  issuer: string
  clientId: string
  redirectUri: string
  code: string
  verifier: string
}>

type ConsumedAuthorizationCode = Readonly<{
  accountId: AccountId
  nonce: string
  scope: string
}>
type Context = SystemDatabaseContext & SystemClockContext

/** PKCE条件付きDELETEでOIDC authorization codeを一度だけ消費する。 */
export class ConsumeOidcAuthorizationCodeAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async consumeOidcAuthorizationCode(
    props: Props,
  ): Promise<ConsumedAuthorizationCode | null | Error> {
    const now = this.c.var.now()
    const secrets = await Promise.all([
      hashOidcSecret(props.code),
      toPkceS256Challenge(props.verifier),
    ])

    try {
      const consumed = await this.c.var.database
        .delete(systemOidcAuthorizationCodes)
        .where(
          and(
            eq(systemOidcAuthorizationCodes.codeHash, secrets[0]),
            eq(systemOidcAuthorizationCodes.issuer, props.issuer),
            eq(systemOidcAuthorizationCodes.clientId, props.clientId),
            eq(systemOidcAuthorizationCodes.redirectUri, props.redirectUri),
            eq(systemOidcAuthorizationCodes.codeChallenge, secrets[1]),
            gt(systemOidcAuthorizationCodes.expiresAt, now),
          ),
        )
        .returning({
          accountId: systemOidcAuthorizationCodes.accountId,
          nonce: systemOidcAuthorizationCodes.nonce,
          scope: systemOidcAuthorizationCodes.scope,
        })

      return consumed.at(0) ?? null
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("authorization code consume failed")
    }
  }
}
