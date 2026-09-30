import {
  SystemAuditEventEntity,
  type SystemAuditEventInput,
} from "@system/domain/entities/system-audit-event.entity"

/** 所有contextの識別子型を保ったまま変更不能な監査事実を作る。 */
export function createSystemAuditEvent<ActorId extends string>(
  input: SystemAuditEventInput<ActorId>,
) {
  return SystemAuditEventEntity.create(input)
}
