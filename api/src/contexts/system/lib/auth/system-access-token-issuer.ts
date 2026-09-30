import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccessTokenSecretValue } from "@system/domain/values/auth/system-access-token-secret.value"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"

type Props = Readonly<{
  accountId: AccountId
  tokenVersion: number
  sessionFamilyId?: string
  machineCredentialId?: string
  now: Date
}>

/** 製品名を含まない固定profileでSystem access tokenを署名する。 */
export class SystemAccessTokenIssuer {
  constructor(private readonly secret: string) {
    Object.freeze(this)
  }

  async issue(input: Props): Promise<string | Error> {
    const accessTokenSecret = SystemAccessTokenSecretValue.create(this.secret)
    if (!(accessTokenSecret instanceof SystemAccessTokenSecretValue)) return accessTokenSecret

    return new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
      {
        accountId: String(input.accountId),
        tokenVersion: input.tokenVersion,
        sessionFamilyId: input.sessionFamilyId,
        machineCredentialId: input.machineCredentialId,
      },
      accessTokenSecret.toString(),
      input.now,
    )
  }
}
