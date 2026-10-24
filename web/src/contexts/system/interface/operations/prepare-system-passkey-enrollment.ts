import type { SystemD1Context } from "@system/configuration/system-context"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { IdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import {
  SystemPasskeyEnrollmentRepository,
  type SystemPasskeyEnrollmentReason,
} from "@system/infrastructure/repositories/auth/system-passkey-enrollment.repository"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"

/** 招待の既定の有効期間。受け取った人がパスキーを登録するまでの猶予。 */
export const SYSTEM_PASSKEY_ENROLLMENT_LIFETIME_MILLISECONDS = 72 * 60 * 60 * 1_000

export type SystemPasskeyEnrollmentGrant = Readonly<{
  token: string
  expiresAt: Date
}>

export type PreparedSystemPasskeyEnrollment = SystemPasskeyEnrollmentGrant &
  Readonly<{ statements: ReadonlyArray<D1PreparedStatement> }>

/**
 * パスキー招待の発行文を作る。IdentityやAccountを作るbatchへ載せ、同じtransactionで保存する。
 * raw tokenは応答で一度だけ返し、DBにはhashだけを残す。
 */
export async function prepareSystemPasskeyEnrollment(
  context: SystemD1Context,
  input: Readonly<{
    accountId: AccountId
    identityId: IdentityId
    reason: SystemPasskeyEnrollmentReason
    issuedByAccountId: AccountId | null
    now: Date
    lifetimeMilliseconds?: number
  }>,
): Promise<PreparedSystemPasskeyEnrollment | Error> {
  const lifetime = input.lifetimeMilliseconds ?? SYSTEM_PASSKEY_ENROLLMENT_LIFETIME_MILLISECONDS
  if (
    !Number.isSafeInteger(input.now.getTime()) ||
    !Number.isSafeInteger(lifetime) ||
    lifetime <= 0
  ) {
    return new Error("passkey enrollment time is invalid")
  }
  const secrets = new SystemPrincipalSecretService()
  const token = secrets.generateRawSecret()
  if (token instanceof Error) return token
  const tokenHash = await secrets.hashRawSecret(token)
  if (tokenHash instanceof Error) return tokenHash
  const expiresAt = new Date(input.now.getTime() + lifetime)
  const metadata = StableSystemAuditJsonValue.create({
    reason: input.reason,
    expires_at: expiresAt.toISOString(),
  })
  if (metadata === null || metadata instanceof Error) {
    return metadata ?? new Error("passkey enrollment audit is empty")
  }
  const event = SystemAuditEventEntity.create({
    actorAccountId: input.issuedByAccountId,
    action: SYSTEM_AUDIT_ACTIONS.authPasskeyEnrollmentIssued,
    targetType: "system:account",
    targetId: input.accountId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: metadata.toString(),
    occurredAt: input.now,
  })
  if (event instanceof Error) return event

  const statements = [
    ...new SystemPasskeyEnrollmentRepository(context).prepareIssue({
      id: crypto.randomUUID(),
      accountId: input.accountId,
      identityId: input.identityId,
      tokenHash,
      reason: input.reason,
      issuedByAccountId: input.issuedByAccountId,
      createdAt: input.now,
      expiresAt,
    }),
    ...new SystemAuditEventRepository(context).prepareAppend(event),
  ]
  return Object.freeze({ token, expiresAt, statements })
}
