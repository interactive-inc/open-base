import type { SystemD1Context } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemTotpCredentialRepository } from "@system/infrastructure/repositories/auth/system-totp-credential.repository"

export type SystemTotpStatus = Readonly<{
  enabled: boolean
  enabledAt: Date | null
  remainingRecoveryCodes: number
}>

/** Account の二段階認証の状態を、秘密鍵と復旧コードの hash を除いて返す。作りかけの登録は無効として扱う。 */
export async function readSystemTotpStatus(
  context: SystemD1Context,
  input: Readonly<{ accountId: AccountId }>,
): Promise<SystemTotpStatus | Error> {
  const credential = await new SystemTotpCredentialRepository(context).find(input.accountId)
  if (credential instanceof Error) return credential

  if (credential === null || !credential.isActive) {
    return Object.freeze({ enabled: false, enabledAt: null, remainingRecoveryCodes: 0 })
  }

  return Object.freeze({
    enabled: true,
    enabledAt: credential.enabledAt,
    remainingRecoveryCodes: credential.recoveryCodeHashes.length,
  })
}
