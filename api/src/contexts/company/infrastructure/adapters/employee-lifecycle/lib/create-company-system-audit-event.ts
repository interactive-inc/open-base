import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import type { SystemRequestAudit } from "@system/configuration/system-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** Company の重要操作を canonical System 監査イベントへ変換する。 */
export function createCompanySystemAuditEvent(input: {
  actorAccountId: string
  actorEmployeeId: EmployeeId
  action: string
  targetType: string
  targetId: string | null
  outcome: "succeeded" | "denied" | "failed"
  reasonCode: string | null
  authorization: unknown
  before: unknown
  after: unknown
  metadata: Readonly<Record<string, unknown>>
  occurredAt: Date
  requestAudit: SystemRequestAudit
}): SystemAuditEventEntity | Error {
  const authorizationJson = StableSystemAuditJsonValue.create(input.authorization)
  if (authorizationJson instanceof Error) return authorizationJson

  const beforeJson = StableSystemAuditJsonValue.create(input.before)
  if (beforeJson instanceof Error) return beforeJson

  const afterJson = StableSystemAuditJsonValue.create(input.after)
  if (afterJson instanceof Error) return afterJson

  const metadataJson = StableSystemAuditJsonValue.create({
    ...input.metadata,
    actorEmployeeId: input.actorEmployeeId,
    requestId: input.requestAudit.requestId,
    clientName: input.requestAudit.clientName,
    clientIp: input.requestAudit.clientIp,
    externalRequestId: input.requestAudit.externalRequestId,
  })
  if (metadataJson instanceof Error) return metadataJson

  return SystemAuditEventEntity.create({
    actorAccountId: input.actorAccountId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    authorizationJson: authorizationJson?.toString() ?? null,
    beforeJson: beforeJson?.toString() ?? null,
    afterJson: afterJson?.toString() ?? null,
    metadataJson: metadataJson?.toString() ?? null,
    occurredAt: input.occurredAt,
  })
}
