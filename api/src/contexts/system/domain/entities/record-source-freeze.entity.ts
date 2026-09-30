import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { recordSourceFreezeSnapshotSchema } from "@system/domain/schemas/records/record-source-freeze.schema"
import type { z } from "zod"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"

type Snapshot = z.output<typeof recordSourceFreezeSnapshotSchema>

/** 一回の書込み停止と解除を残す。再停止は別IDとし、旧世代を再利用しない。 */
export class RecordSourceFreezeEntity {
  readonly snapshot: Readonly<Snapshot>

  private constructor(snapshot: Snapshot) {
    this.snapshot = Object.freeze({
      ...snapshot,
      release: snapshot.release === null ? null : Object.freeze({ ...snapshot.release }),
    })
    Object.freeze(this)
  }

  static create(input: unknown): RecordSourceFreezeEntity | Error {
    const parsed = recordSourceFreezeSnapshotSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const value = parsed.data
    if (
      Date.parse(value.createdAt) < 0 ||
      value.actorAccountId.trim().length === 0 ||
      (value.release === null
        ? value.revision !== 1
        : value.revision !== 2 ||
          value.release.actorAccountId.trim().length === 0 ||
          value.release.auditEventId === value.auditEventId ||
          Date.parse(value.release.at) < Date.parse(value.createdAt))
    )
      return new Error("record source freeze history is invalid")
    return new RecordSourceFreezeEntity(value)
  }

  release(input: unknown): RecordSourceFreezeEntity | Error {
    if (this.snapshot.release !== null) return new Error("record source freeze is already released")
    return RecordSourceFreezeEntity.create({ ...this.snapshot, revision: 2, release: input })
  }

  audit(before: RecordSourceFreezeEntity | null): SystemAuditEventEntity | Error {
    const value = this.snapshot
    const release = value.release
    return SystemAuditEventEntity.restore({
      eventId: release?.auditEventId ?? value.auditEventId,
      actorAccountId: release?.actorAccountId ?? value.actorAccountId,
      action:
        release === null
          ? SYSTEM_AUDIT_ACTIONS.systemRecordSourceFreezeCreated
          : SYSTEM_AUDIT_ACTIONS.systemRecordSourceFreezeReleased,
      targetType: "system:record-source-freeze",
      targetId: value.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({
        required_permission_keys: ["system:admin"],
        principal_kind: "human",
        step_up: true,
      }),
      beforeJson: before === null ? null : JSON.stringify(before.snapshot),
      afterJson: JSON.stringify(value),
      metadataJson: null,
      occurredAtEpochMilliseconds: Date.parse(release?.at ?? value.createdAt),
    })
  }

  matchesActiveGeneration(
    input: Readonly<{
      id: string
      sourceNamespace: string
      ownerContext: string
    }>,
  ): boolean {
    return (
      this.snapshot.release === null &&
      this.snapshot.id === input.id &&
      this.snapshot.sourceNamespace === input.sourceNamespace &&
      this.snapshot.ownerContext === input.ownerContext
    )
  }
}
