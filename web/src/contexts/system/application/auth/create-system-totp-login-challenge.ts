import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import { SystemTotpLoginChallengeEntity } from "@system/domain/entities/system-totp-login-challenge.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemTotpLoginChallengeRepository } from "@system/infrastructure/repositories/auth/system-totp-login-challenge.repository"
import { generateOpaqueToken } from "@system/lib/auth/generate-opaque-token"
import { systemLoginCodeHash } from "@system/lib/auth/system-login-code-hash"

type Context = SystemD1Context & SystemClockContext

export type SystemTotpLoginChallengeIssue = Readonly<{
  challenge: string
  expiresInSeconds: number
}>

/**
 * パスワードを確かめた Account に、ワンタイムコードを待つ短命の challenge を発行する。
 * challenge は発行時の失効世代へ結び付け、その間にパスワードの再設定などで世代が進めば使えない。
 */
export class CreateSystemTotpLoginChallenge {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    props: Readonly<{ accountId: AccountId; tokenVersion: number }>,
  ): Promise<SystemTotpLoginChallengeIssue | Error> {
    const now = this.c.var.now()
    if (!Number.isSafeInteger(now.getTime())) return new Error("System clock is invalid")

    const challenge = generateOpaqueToken()
    const challengeHash = await systemLoginCodeHash(challenge)
    if (challengeHash instanceof Error) return challengeHash

    const issued = SystemTotpLoginChallengeEntity.issue({
      challengeHash,
      accountId: props.accountId,
      tokenVersion: props.tokenVersion,
      now,
    })
    if (issued instanceof Error) return issued

    const created = await new SystemTotpLoginChallengeRepository(this.c).create(issued)
    if (created instanceof Error) return created

    return Object.freeze({
      challenge,
      expiresInSeconds: SystemTotpLoginChallengeEntity.TTL_SECONDS,
    })
  }
}
