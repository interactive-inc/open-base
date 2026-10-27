import { CreateSystemTotpLoginChallenge } from "@system/application/auth/create-system-totp-login-challenge"
import type { SystemClockContext, SystemD1Context } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** パスワードを確かめた Account に、ワンタイムコードを待つ短命の challenge を発行する。 */
export function createSystemTotpLoginChallenge(
  context: SystemD1Context & SystemClockContext,
  input: Readonly<{ accountId: AccountId; tokenVersion: number }>,
) {
  return new CreateSystemTotpLoginChallenge(context).execute(input)
}
