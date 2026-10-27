import { BeginSystemTotpEnrollment } from "@system/application/auth/begin-system-totp-enrollment"
import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** 認証アプリへの登録を始め、新しい秘密鍵と認証アプリへ渡す URI を一度だけ返す。 */
export function beginSystemTotpEnrollment(
  context: SystemD1Context & SystemClockContext,
  input: Readonly<{
    accountId: AccountId
    keyMaterial: string
    issuer: string
    accountName: string
  }>,
) {
  return new BeginSystemTotpEnrollment(context).execute(input)
}
