import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import type { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import type { z } from "zod"
import { preservedRecordSnapshotSchema } from "@system/domain/schemas/records/record-preservation-input.schema"

type Props = z.output<typeof preservedRecordSnapshotSchema>

/** 原記録と本文の保持・開示設定・確定根拠の対応を固定する。 */
export class PreservedRecordEntity {
  readonly snapshot: Readonly<Props & { source: PreservedRecordSourceValue["props"] }>

  private constructor(
    props: Props,
    readonly source: PreservedRecordSourceValue,
  ) {
    this.snapshot = Object.freeze({
      ...props,
      source: source.props,
      sourceAuthorizationRef: Object.freeze({ ...props.sourceAuthorizationRef }),
    })
    Object.freeze(this)
  }

  static create(input: unknown): PreservedRecordEntity | Error {
    const parsed = preservedRecordSnapshotSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const source = PreservedRecordSourceValue.create(parsed.data.source)
    if (source instanceof Error) return source
    if (Date.parse(source.props.capturedAt) > Date.parse(parsed.data.finalizedAt)) {
      return new Error("record cannot be finalized before capture")
    }
    return new PreservedRecordEntity(parsed.data, source)
  }

  matchesPreservation(preservation: AttachmentPreservationEntity): boolean {
    const held = preservation.snapshot
    return (
      held.id === this.snapshot.preservationId &&
      held.attachmentId === this.snapshot.attachmentId &&
      held.sha256 === this.snapshot.attachmentDigest &&
      held.actorAccountId === this.snapshot.actorAccountId &&
      held.createdAt === this.snapshot.finalizedAt &&
      held.release === null &&
      (held.kind === "hold" ||
        (held.retainUntil !== null &&
          Date.parse(held.retainUntil) > Date.parse(this.snapshot.finalizedAt)))
    )
  }
}
