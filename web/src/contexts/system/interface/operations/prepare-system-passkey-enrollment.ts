import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import type { SystemD1Context } from "@system/configuration/system-context"
import { SystemPasskeyEnrollmentAdapter } from "@system/infrastructure/adapters/auth/system-passkey-enrollment.adapter"

export type SystemPasskeyEnrollmentGrant = Readonly<{ token: string; expiresAt: Date }>

/** パスキー招待の発行文を準備し、呼び出し側のAccount作成と同じ保存単位へ載せる。 */
export function prepareSystemPasskeyEnrollment(
  context: SystemD1Context,
  input: Readonly<{
    accountId: AccountId
    identityId: IdentityId
    reason: "bootstrap" | "provisioning" | "reissue" | "recovery"
    issuedByAccountId: AccountId | null
    now: Date
    lifetimeMilliseconds?: number
  }>,
): Promise<
  | (SystemPasskeyEnrollmentGrant & Readonly<{ statements: ReadonlyArray<D1PreparedStatement> }>)
  | Error
> {
  return new SystemPasskeyEnrollmentAdapter(context).prepare(input)
}
