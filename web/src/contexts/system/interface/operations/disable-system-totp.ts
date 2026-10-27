import { DisableSystemTotp } from "@system/application/auth/disable-system-totp"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** ワンタイムコードか復旧コードで本人確認し、二段階認証を無効にする。 */
export function disableSystemTotp(
  context: SystemD1Context & SystemDatabaseContext & SystemClockContext,
  input: Readonly<{ accountId: AccountId; code: string; keyMaterial: string }>,
) {
  return new DisableSystemTotp(context).execute(input)
}
