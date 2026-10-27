import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemPasskeyEnrollmentAdapter } from "@system/infrastructure/adapters/auth/system-passkey-enrollment.adapter"

export type SystemPasskeyEnrollmentGrant = Readonly<{ token: string; expiresAt: Date }>

/** パスキー招待の発行文を準備し、呼び出し側のAccount作成と同じ保存単位へ載せる。 */
export function prepareSystemPasskeyEnrollment(
  context: SystemD1Context,
  input: Parameters<SystemPasskeyEnrollmentAdapter["prepare"]>[0],
) {
  return new SystemPasskeyEnrollmentAdapter(context).prepare(input)
}
