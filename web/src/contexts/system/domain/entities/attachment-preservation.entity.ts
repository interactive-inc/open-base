import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import {
  attachmentPreservationCommandSchema,
  attachmentPreservationSnapshotSchema,
} from "@system/domain/schemas/attachments/attachment-preservation.schema"
import { SystemAttachmentError } from "@system/domain/errors"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { z } from "zod"

type Snapshot = z.output<typeof attachmentPreservationSnapshotSchema>

/** 内容を固定した添付の保全と、削除停止の一度だけの解除を記録する。 */
export class AttachmentPreservationEntity {
  readonly snapshot: Readonly<Snapshot>

  private constructor(snapshot: Snapshot) {
    this.snapshot = Object.freeze({
      ...snapshot,
      release: snapshot.release === null ? null : Object.freeze(snapshot.release),
    })
    Object.freeze(this)
  }

  static create(input: unknown): AttachmentPreservationEntity | SystemAttachmentError {
    const parsed = attachmentPreservationSnapshotSchema.safeParse(input)
    if (!parsed.success)
      return new SystemAttachmentError("validation", "preservation_invalid", "保全の指定が不正です")
    const value = parsed.data
    if (
      Date.parse(value.createdAt) < 0 ||
      (value.kind === "hold" && value.retainUntil !== null) ||
      (value.kind === "retention" &&
        (value.retainUntil === null ||
          Date.parse(value.retainUntil) <= Date.parse(value.createdAt))) ||
      (value.release === null
        ? value.revision !== 1
        : value.revision !== 2 ||
          value.kind !== "hold" ||
          Date.parse(value.release.at) < Date.parse(value.createdAt))
    )
      return new SystemAttachmentError(
        "validation",
        "preservation_period_invalid",
        "保全の期間または解除が不正です",
      )
    return new AttachmentPreservationEntity(value)
  }

  matchesCreation(input: unknown): boolean {
    const command = attachmentPreservationCommandSchema.safeParse(input)
    return (
      command.success &&
      JSON.stringify(command.data) ===
        JSON.stringify(attachmentPreservationCommandSchema.strip().parse(this.snapshot))
    )
  }

  release(input: unknown): AttachmentPreservationEntity | SystemAttachmentError {
    if (this.snapshot.release !== null || this.snapshot.kind !== "hold") {
      return new SystemAttachmentError(
        "validation",
        "preservation_release_conflict",
        "この保全は解除できません",
      )
    }
    return AttachmentPreservationEntity.create({ ...this.snapshot, revision: 2, release: input })
  }

  audit(before: AttachmentPreservationEntity | null): SystemAuditEventEntity | Error {
    const release = this.snapshot.release
    return SystemAuditEventEntity.restore({
      eventId: release?.auditEventId ?? this.snapshot.auditEventId,
      actorAccountId: release?.actorAccountId ?? this.snapshot.actorAccountId,
      action:
        release === null
          ? SYSTEM_AUDIT_ACTIONS.systemAttachmentPreservationCreated
          : SYSTEM_AUDIT_ACTIONS.systemAttachmentPreservationReleased,
      targetType: "system:attachment-preservation",
      targetId: this.snapshot.id,
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
      occurredAtEpochMilliseconds: Date.parse(release?.at ?? this.snapshot.createdAt),
    })
  }
}
