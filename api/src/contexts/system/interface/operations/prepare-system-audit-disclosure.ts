import type {
  SystemD1Context,
  SystemAuthorizationContext,
} from "@system/configuration/system-context"
import { SystemAuditDisclosureReadAdapter } from "@system/infrastructure/adapters/audit/system-audit-disclosure-read.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"
import { SystemAuditDisclosureHttpError } from "@system/interface/errors"

/** HTTPの読取目的と現在の資格を開示条件へ渡し、拒否も監査する。 */
export async function prepareSystemAuditDisclosure(
  context: SystemD1Context & SystemAuthorizationContext,
  input: Readonly<{
    permission: string
    purpose: string | null
    now: Date
    action: string
    targetId: string | null
  }>,
) {
  const proof = await new SystemAuditDisclosureReadAdapter(context).prepare({
    accountId: context.var.userId,
    tokenVersion: context.var.accountTokenVersion,
    permission: input.permission,
    purpose: input.purpose,
    now: input.now,
  })
  if (!(proof instanceof Error)) return proof
  if (proof.kind === "forbidden") {
    const audit = SystemAuditEventEntity.create({
      actorAccountId: context.var.userId,
      action: input.action,
      targetType: "system:audit-event",
      targetId: input.targetId,
      outcome: "denied",
      reasonCode: "disclosure_forbidden",
      authorizationJson: JSON.stringify({
        required_permission_keys: [input.permission],
        purpose: input.purpose,
      }),
      beforeJson: null,
      afterJson: null,
      metadataJson: null,
      occurredAt: input.now,
    })
    if (
      audit instanceof Error ||
      (await new SystemAuditEventRepository(context).append(audit)) instanceof Error
    )
      throw new SystemAuditDisclosureHttpError({
        status: 503,
        code: "audit_unavailable",
        detail: "監査を記録できません",
      })
    throw new SystemAuditDisclosureHttpError({
      status: 403,
      code: "forbidden",
      detail: "監査の開示条件を満たしていません",
    })
  }
  throw new SystemAuditDisclosureHttpError({
    status: 503,
    code: "audit_unavailable",
    detail: "監査の開示条件を確認できません",
    cause: proof,
  })
}
