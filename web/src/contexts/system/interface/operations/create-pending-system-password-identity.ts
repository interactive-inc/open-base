import type { PasswordResetTokenHash } from "@system/domain/schemas/auth/password-reset-token-hash.schema"
import { CreatePendingSystemPasswordIdentityAdapter } from "@system/infrastructure/adapters/identity/create-pending-system-password-identity.adapter"

/** 未設定password Identityと設定challengeを監査とともに作成する。 */
export function createPendingSystemPasswordIdentity(
  database: D1Database,
  input: Readonly<{
    actorAccountId: string
    accountId: string
    email: string
    pendingPasswordHash: string
    tokenHash: PasswordResetTokenHash
    now: Date
    expiresAt: Date
    metadataJson: string | null
  }>,
) {
  return new CreatePendingSystemPasswordIdentityAdapter({
    env: { DB: database },
  }).createPendingSystemPasswordIdentity(input)
}
