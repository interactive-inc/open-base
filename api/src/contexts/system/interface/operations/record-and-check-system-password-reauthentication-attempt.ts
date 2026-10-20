import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"

/** 認証済みAccountのパスワード再入力を記録し、ログインとは別のAccount単位の上限を判定する。 */
export function recordAndCheckSystemPasswordReauthenticationAttempt(
  context: SystemDatabaseContext & SystemClockContext,
  props: Readonly<{ accountId: string; now?: number }>,
) {
  return new LoginRateLimitAdapter(context).recordAndCheckPasswordReauthentication(props)
}
