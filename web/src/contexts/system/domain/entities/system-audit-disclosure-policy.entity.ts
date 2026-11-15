import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  auditDisclosureCommandSchema,
  auditDisclosurePolicySchema,
  auditDisclosureStoredPolicySchema,
} from "@system/domain/schemas/audit/system-audit-disclosure-policy.schema"
import type { z } from "zod"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SystemAuditDisclosureError } from "@system/domain/errors"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

type Props = z.output<typeof auditDisclosureStoredPolicySchema>

/** 全体またはAccountごとの監査開示条件を、変更不能な版として記録する。 */
export class SystemAuditDisclosurePolicyEntity {
  readonly snapshot: Readonly<Props>

  private constructor(
    props: Props,
    private readonly sourceJson: string | null = null,
  ) {
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
    if (parsed.data.scope === "*" && parsed.data.supersedesLegacyRevision !== undefined)
      return new SystemAuditDisclosureError("invalid")
    if (
      Date.parse(parsed.data.recordedAt) < 0 ||
      (parsed.data.expiresAt !== null &&
        Date.parse(parsed.data.expiresAt) <= Date.parse(parsed.data.recordedAt))
    )
      return new SystemAuditDisclosureError("invalid")
    return new SystemAuditDisclosurePolicyEntity(parsed.data)
  }

  /** 保存済みの版は識別子を改変せず復元し、適用先は読取側が照合する。 */
  static restore(input: unknown): SystemAuditDisclosurePolicyEntity | SystemAuditDisclosureError {
    const parsed = auditDisclosureStoredPolicySchema.safeParse(input)
    if (!parsed.success) return new SystemAuditDisclosureError("invalid", parsed.error)
    if (
      Date.parse(parsed.data.recordedAt) < 0 ||
      (parsed.data.expiresAt !== null &&
        Date.parse(parsed.data.expiresAt) <= Date.parse(parsed.data.recordedAt))
    )
      return new SystemAuditDisclosureError("invalid")
    return new SystemAuditDisclosurePolicyEntity(parsed.data)
  }

  /** 監査の原文は改行・項目順も保存し、次の版の変更前記録へそのまま渡す。 */
  static restoreJson(
    source: string,
  ): SystemAuditDisclosurePolicyEntity | SystemAuditDisclosureError {
    try {
      const policy = SystemAuditDisclosurePolicyEntity.restore(JSON.parse(source))
      return policy instanceof Error
        ? policy
        : new SystemAuditDisclosurePolicyEntity(policy.snapshot, source)
    } catch (cause) {
      return new SystemAuditDisclosureError("invalid", cause)
    }
  }

  /** 明示された旧版の解除を、新設定の監査記録に結び付ける。 */
  retireInFavorOf(
    replacement: SystemAuditDisclosurePolicyEntity,
    ids: Readonly<{ commandId: string; auditEventId: string }>,
  ): SystemAuditDisclosurePolicyEntity | SystemAuditDisclosureError {
    const next = replacement.snapshot
    if (
      this.snapshot.scope === "*" ||
      this.snapshot.scope === next.scope ||
      !zAccountId.safeParse(next.scope).success ||
      !zAccountId.safeParse(next.actorAccountId).success ||
      next.supersedesLegacyRevision !== this.snapshot.revision ||
      Date.parse(next.recordedAt) < Date.parse(this.snapshot.recordedAt)
    )
      return new SystemAuditDisclosureError("invalid")
    return SystemAuditDisclosurePolicyEntity.restore({
      ...this.snapshot,
      ...ids,
      enabled: false,
      expiresAt: null,
      revision: this.snapshot.revision + 1,
      reason: next.reason,
      actorAccountId: next.actorAccountId,
      recordedAt: next.recordedAt,
      supersedesLegacyRevision: undefined,
      supersededByAuditEventId: next.auditEventId,
    })
  }

  matches(input: unknown): boolean {
    const parsed = auditDisclosureCommandSchema.safeParse(input)
    if (!parsed.success) return false
    const command = auditDisclosureCommandSchema.safeParse({
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
      supersedesLegacyRevision: this.snapshot.supersedesLegacyRevision,
    })
    return command.success && JSON.stringify(command.data) === JSON.stringify(parsed.data)
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
      beforeJson: before === null ? null : (before.sourceJson ?? JSON.stringify(before.snapshot)),
      afterJson: JSON.stringify(this.snapshot),
      metadataJson: null,
      occurredAtEpochMilliseconds: Date.parse(this.snapshot.recordedAt),
    })
  }
}
