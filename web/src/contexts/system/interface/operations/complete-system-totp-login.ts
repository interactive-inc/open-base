import { CompleteSystemTotpLogin } from "@system/application/auth/complete-system-totp-login"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemDatabaseContext,
} from "@system/configuration/system-context"

/** challenge とワンタイムコード（または復旧コード）を確かめ、ログインの 2 段目を終える。 */
export function completeSystemTotpLogin(
  context: SystemD1Context & SystemDatabaseContext & SystemClockContext,
  input: Readonly<{ challenge: string; code: string; keyMaterial: string }>,
) {
  return new CompleteSystemTotpLogin(context).execute(input)
}
