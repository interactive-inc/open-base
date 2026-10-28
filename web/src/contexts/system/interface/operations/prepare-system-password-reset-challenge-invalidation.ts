import type { SystemDatabase } from "@system/configuration/system-context"
import {
  InvalidateSystemPasswordResetChallengesAdapter,
  type InvalidateSystemPasswordResetChallengesInput,
} from "@system/infrastructure/adapters/auth/invalidate-system-password-reset-challenges.adapter"

/** パスワード変更と同じ保存単位に含める、既発行リンクの失効文を返す。 */
export function prepareSystemPasswordResetChallengeInvalidation(
  database: SystemDatabase,
  input: InvalidateSystemPasswordResetChallengesInput,
) {
  return new InvalidateSystemPasswordResetChallengesAdapter(database).prepare(input)
}
