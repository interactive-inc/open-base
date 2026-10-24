import type { SystemD1Context } from "@system/configuration/system-context"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import {
  SystemPasskeyEnrollmentRepository,
  type SystemPasskeyEnrollmentTarget,
} from "@system/infrastructure/repositories/auth/system-passkey-enrollment.repository"
import { hashSystemPasskeyEnrollmentToken } from "@system/lib/auth/hash-system-passkey-enrollment-token"

/**
 * パスキーの登録を検証した後に招待を消費する。消費とIdentityの有効化と監査は同じbatchで行う。
 * 使えない招待や同時に使われた招待は null を返す。
 */
export async function completeSystemPasskeyEnrollment(
  context: SystemD1Context,
  input: Readonly<{ token: string; now: Date }>,
): Promise<SystemPasskeyEnrollmentTarget | null | Error> {
  const tokenHash = await hashSystemPasskeyEnrollmentToken(input.token)
  if (tokenHash === null || tokenHash instanceof Error) return tokenHash
  const repository = new SystemPasskeyEnrollmentRepository(context)
  const target = await repository.findUsable(tokenHash, input.now)
  if (target === null || target instanceof Error) return target
  const event = SystemAuditEventEntity.create({
    actorAccountId: target.accountId,
    action: SYSTEM_AUDIT_ACTIONS.authPasskeyEnrollmentCompleted,
    targetType: "system:account",
    targetId: target.accountId,
    outcome: "succeeded",
    reasonCode: null,
    authorizationJson: null,
    beforeJson: null,
    afterJson: null,
    metadataJson: null,
    occurredAt: input.now,
  })
  if (event instanceof Error) return event
  const consumed = await repository.consume(
    tokenHash,
    input.now,
    new SystemAuditEventRepository(context).prepareAppend(event),
  )
  if (consumed === null || consumed instanceof Error) return consumed
  return target
}
