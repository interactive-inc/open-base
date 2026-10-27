import { EnableSystemTotp } from "@system/application/auth/enable-system-totp"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** 最初のワンタイムコードを確かめて登録を有効にし、復旧コードを一度だけ返す。 */
export function enableSystemTotp(
  context: SystemD1Context & SystemDatabaseContext & SystemClockContext,
  input: Readonly<{ accountId: AccountId; code: string; keyMaterial: string }>,
) {
  return new EnableSystemTotp(context).execute(input)
}
