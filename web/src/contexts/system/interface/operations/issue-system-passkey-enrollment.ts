import type { SystemD1Context } from "@system/configuration/system-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import {
  SystemPasskeyEnrollmentRepository,
  type SystemPasskeyEnrollmentReason,
} from "@system/infrastructure/repositories/auth/system-passkey-enrollment.repository"
import {
  prepareSystemPasskeyEnrollment,
  type SystemPasskeyEnrollmentGrant,
} from "@system/interface/operations/prepare-system-passkey-enrollment"

/**
 * 既存のパスキーIdentityへ招待を発行する。作成直後の登録と、パスキーを失くしたときの再登録に使う。
 * Accountが無効、またはパスキーIdentityが無ければ "no_identity" を返す。
 */
export async function issueSystemPasskeyEnrollment(
  context: SystemD1Context,
  input: Readonly<{
    accountId: AccountId
    reason: Exclude<SystemPasskeyEnrollmentReason, "bootstrap">
    issuedByAccountId: AccountId | null
    now: Date
    lifetimeMilliseconds?: number
  }>,
): Promise<(SystemPasskeyEnrollmentGrant & { identityId: IdentityId }) | "no_identity" | Error> {
  const target = await new SystemPasskeyEnrollmentRepository(context).findTarget(input.accountId)
  if (target instanceof Error) return target
  if (target === null) return "no_identity"
  const prepared = await prepareSystemPasskeyEnrollment(context, {
    ...input,
    identityId: target.identityId,
  })
  if (prepared instanceof Error) return prepared
  try {
    const results = await context.env.DB.batch([...prepared.statements])
    if (results.some((result) => !result.success)) {
      return new Error("passkey enrollment issuance did not succeed")
    }
  } catch (caught) {
    return caught instanceof Error ? caught : new Error("failed to issue passkey enrollment")
  }
  return Object.freeze({
    token: prepared.token,
    expiresAt: prepared.expiresAt,
    identityId: target.identityId,
  })
}
