import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"

/** パスワード再入力に成功したAccountの試行記録を消す。 */
export function resetSystemPasswordReauthenticationAttempts(
  context: SystemDatabaseContext & SystemClockContext,
  accountId: string,
) {
  return new LoginRateLimitAdapter(context).resetPasswordReauthentication({ accountId })
}
