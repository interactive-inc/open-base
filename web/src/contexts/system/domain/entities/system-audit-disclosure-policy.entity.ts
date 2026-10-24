import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  auditDisclosureCommandSchema,
  auditDisclosurePolicySchema,
} from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import type { z } from "zod"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditDisclosureError } from "@system/domain/errors"

type Props = z.output<typeof auditDisclosurePolicySchema>

/** 全体またはAccountごとの監査開示条件を、変更不能な版として記録する。 */
export class SystemAuditDisclosurePolicyEntity {
  readonly snapshot: Readonly<Props>

  private constructor(props: Props) {
    this.snapshot = Object.freeze({
      ...props,
      allowedFields: Object.freeze(props.allowedFields),
      allowedTargetTypes:
        props.allowedTargetTypes === null ? null : Object.freeze(props.allowedTargetTypes),
      allowedPurposes: props.allowedPurposes === null ? null : Object.freeze(props.allowedPurposes),
    })
    Object.freeze(this)
  }

  static create(input: unknown): SystemAuditDisclosurePolicyEntity | SystemAuditDisclosureError {
    const parsed = auditDisclosurePolicySchema.safeParse(input)
    if (!parsed.success) return new SystemAuditDisclosureError("invalid", parsed.error)
    if (
      Date.parse(parsed.data.recordedAt) < 0 ||
      (parsed.data.expiresAt !== null &&
        Date.parse(parsed.data.expiresAt) <= Date.parse(parsed.data.recordedAt))
    )
      return new SystemAuditDisclosureError("invalid")
    return new SystemAuditDisclosurePolicyEntity(parsed.data)
  }

  matches(input: unknown): boolean {
    const parsed = auditDisclosureCommandSchema.safeParse(input)
    if (!parsed.success) return false
    const command = auditDisclosureCommandSchema.parse({
      scope: this.snapshot.scope,
      commandId: this.snapshot.commandId,
      expectedRevision: this.snapshot.revision - 1,
      enabled: this.snapshot.enabled,
      allowedFields: this.snapshot.allowedFields,
      allowedTargetTypes: this.snapshot.allowedTargetTypes,
      allowedPurposes: this.snapshot.allowedPurposes,
      expiresAt: this.snapshot.expiresAt,
      reason: this.snapshot.reason,
      actorAccountId: this.snapshot.actorAccountId,
    })
    return JSON.stringify(command) === JSON.stringify(parsed.data)
  }

  audit(before: SystemAuditDisclosurePolicyEntity | null): SystemAuditEventEntity | Error {
    return SystemAuditEventEntity.restore({
      eventId: this.snapshot.auditEventId,
      actorAccountId: this.snapshot.actorAccountId,
      action: SYSTEM_AUDIT_ACTIONS.systemAuditDisclosurePublished,
      targetType: "system:audit-disclosure-policy",
      targetId: this.snapshot.scope,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        required_permission_keys: ["system:admin"],
        principal_kind: "human",
        step_up: true,
      }),
      beforeJson: before === null ? null : JSON.stringify(before.snapshot),
      afterJson: JSON.stringify(this.snapshot),
      metadataJson: null,
      occurredAtEpochMilliseconds: Date.parse(this.snapshot.recordedAt),
    })
  }
}
