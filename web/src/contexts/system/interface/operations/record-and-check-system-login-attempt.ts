import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"

/** ログイン試行を記録して識別子とIPの制限を判定する。 */
export function recordAndCheckSystemLoginAttempt(
  context: SystemDatabaseContext & SystemClockContext,
  props: Readonly<{ identifier: string; ip: string | null; now?: number }>,
) {
  return new LoginRateLimitAdapter(context).recordAndCheck(props)
}
