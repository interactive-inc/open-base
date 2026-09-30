import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"

export type SessionRotationAuditEvents = Readonly<{
  rotated: SystemAuditEventEntity
  reused: SystemAuditEventEntity
  invalid: SystemAuditEventEntity
}>
