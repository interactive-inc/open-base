import { RegenerateSystemTotpRecoveryCodes } from "@system/application/auth/regenerate-system-totp-recovery-codes"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** ワンタイムコードか復旧コードで本人確認し、復旧コードをすべて作り直す。 */
export function regenerateSystemTotpRecoveryCodes(
  context: SystemD1Context & SystemDatabaseContext & SystemClockContext,
  input: Readonly<{ accountId: AccountId; code: string; keyMaterial: string }>,
) {
  return new RegenerateSystemTotpRecoveryCodes(context).execute(input)
}
