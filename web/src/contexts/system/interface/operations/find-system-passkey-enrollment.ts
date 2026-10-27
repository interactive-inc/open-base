import type { SystemD1Context } from "@system/configuration/system-context"
import {
  SystemPasskeyEnrollmentAdapter,
  type SystemPasskeyEnrollmentTarget,
} from "@system/infrastructure/adapters/auth/system-passkey-enrollment.adapter"
import { hashSystemPasskeyEnrollmentToken } from "@system/lib/auth/hash-system-passkey-enrollment-token"

/** 招待tokenが今使えるなら、その対象を返す。 */
export async function findSystemPasskeyEnrollment(
  context: SystemD1Context,
  input: Readonly<{ token: string; now: Date }>,
): Promise<SystemPasskeyEnrollmentTarget | null | Error> {
  const tokenHash = await hashSystemPasskeyEnrollmentToken(input.token)
  if (tokenHash === null || tokenHash instanceof Error) return tokenHash
  return await new SystemPasskeyEnrollmentAdapter(context).findUsable(tokenHash, input.now)
}
