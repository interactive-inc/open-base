import type { SystemEmailContext } from "@system/configuration/system-context"
import { AccountCreatedEmailAdapter } from "@system/infrastructure/adapters/auth/account-created-email.adapter"

/** 新規Accountのpassword設定案内を送る。 */
export function sendSystemAccountCreatedEmail(
  context: SystemEmailContext,
  props: Readonly<{ to: string; origin: string; token: string }>,
) {
  return new AccountCreatedEmailAdapter(context).send(props)
}
