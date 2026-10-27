import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccessTokenStateAdapter } from "@system/infrastructure/adapters/auth/system-access-token-state.adapter"

/** 検証済みtokenのAccountと現在の失効状態を照合する。 */
export function resolveSystemAccessTokenState(
  database: D1Database,
  input: Readonly<{
    accountId: AccountId
    tokenVersion: number
    issuedAtMs: number
    machineCredentialId?: string
    sessionFamilyId: string | null
    at: Date
  }>,
) {
  return new SystemAccessTokenStateAdapter({ database }).resolve(input)
}
