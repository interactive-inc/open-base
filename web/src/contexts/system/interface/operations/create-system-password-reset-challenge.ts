import type { PasswordResetTokenHash } from "@system/domain/schemas/auth/password-reset-token-hash.schema"
import { CreateSystemPasswordResetChallengeAdapter } from "@system/infrastructure/adapters/auth/create-system-password-reset-challenge.adapter"

/** password設定用challengeを監査とともに作成する。 */
export function createSystemPasswordResetChallenge(
  database: D1Database,
  input: Readonly<{
    actorAccountId: string | null
    id: string
    tokenHash: PasswordResetTokenHash
    accountId: string
    identityId: string
    createdAt: Date
    expiresAt: Date
    metadataJson: string | null
  }>,
) {
  return new CreateSystemPasswordResetChallengeAdapter({
    env: { DB: database },
  }).createSystemPasswordResetChallenge(input)
}
