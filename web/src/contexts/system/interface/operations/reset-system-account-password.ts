import { ResetPassword } from "@system/application/auth/reset-password"
import type {
  SystemClockContext,
  SystemD1Context,
  SystemPasswordHashContext,
  SystemRequestAuditContext,
} from "@system/configuration/system-context"

/** 有効なchallengeを消費し、passwordとtoken versionを監査とともに更新する。 */
export function resetSystemAccountPassword(
  context: SystemD1Context &
    SystemClockContext &
    SystemPasswordHashContext &
    SystemRequestAuditContext,
  input: Readonly<{ rawToken: string; newPassword: string }>,
) {
  return new ResetPassword(context).execute(input)
}
