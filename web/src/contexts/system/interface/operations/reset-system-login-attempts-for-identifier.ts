import type {
  SystemClockContext,
  SystemDatabaseContext,
} from "@system/configuration/system-context"
import { LoginRateLimitAdapter } from "@system/infrastructure/adapters/auth/login-rate-limit.adapter"

/** 成功したログイン識別子の試行記録を消す。 */
export function resetSystemLoginAttemptsForIdentifier(
  context: SystemDatabaseContext & SystemClockContext,
  identifier: string,
) {
  return new LoginRateLimitAdapter(context).resetForIdentifier({ identifier })
}
