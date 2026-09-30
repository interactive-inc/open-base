import {
  recordPreservationIntentSchema,
  recordPreservationRequestSchema,
} from "@system/domain/schemas/records/record-preservation-input.schema"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import { AttachmentPreservationEntity } from "@system/domain/entities/attachment-preservation.entity"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

type Props = Readonly<{ canonical: CanonicalSystemJsonValue; digest: ProposalDigestValue }>

/** 承認対象の原記録・保持条件・開示先を固定し、実行時の監査IDや確定日時から分離する。 */
export class RecordPreservationProposalValue {
  private constructor(readonly props: Props) {
    Object.freeze(this)
  }

  /** 申請条件とサーバーが取得・保存した記録を結び、再送でも同じ識別子を使う承認対象を作る。 */
  static async fromRequest(
    input: Readonly<{
      request: unknown
      recordId: string
      source: PreservedRecordSourceValue
      actorAccountId: string
      attachmentId: string
      attachmentDigest: string
      sourceAuthorizationRef: unknown
      preservationId: string
      disclosurePolicyId: string
    }>,
  ): Promise<RecordPreservationProposalValue | Error> {
    const request = recordPreservationRequestSchema.safeParse(input.request)
    if (!request.success) return request.error
    return RecordPreservationProposalValue.restore({
      version: 1,
      operation: "system.record.preserve",
      recordId: input.recordId,
      source: input.source.props,
      actorAccountId: input.actorAccountId,
      attachmentId: input.attachmentId,
      attachmentDigest: input.attachmentDigest,
      sourceAuthorizationRef: input.sourceAuthorizationRef,
      reason: request.data.reason,
      preservation: { ...request.data.preservation, id: input.preservationId },
      disclosure: { ...request.data.disclosure, id: input.disclosurePolicyId, revision: 1 },
    })
  }

  /** 再送された保持・開示条件を照合する。申請者・原記録・手続きの同一性と現在の権限は別途検査する。 */
  matchesRequest(request: unknown): boolean {
    const parsed = recordPreservationRequestSchema.safeParse(request)
    if (!parsed.success) return false
    const intent = recordPreservationIntentSchema.safeParse(
      JSON.parse(this.props.canonical.toString()),
    )
    if (!intent.success) return false
    const expected = CanonicalSystemJsonValue.create({
      reason: intent.data.reason,
      preservation: {
        kind: intent.data.preservation.kind,
        retainUntil: intent.data.preservation.retainUntil,
        reason: intent.data.preservation.reason,
      },
      disclosure: { reason: intent.data.disclosure.reason, grants: intent.data.disclosure.grants },
    })
    const received = CanonicalSystemJsonValue.create(parsed.data)
    return !(expected instanceof Error) && !(received instanceof Error) && expected.equals(received)
  }

  static async create(
    input: Readonly<{
      record: PreservedRecordEntity
      disclosure: PreservedRecordDisclosurePolicyEntity
      preservation: AttachmentPreservationEntity
    }>,
  ): Promise<RecordPreservationProposalValue | Error> {
    const record = input.record.snapshot
    const disclosure = input.disclosure.snapshot
    const preservation = input.preservation.snapshot
    if (
      !input.record.matchesPreservation(input.preservation) ||
      disclosure.recordId !== record.id ||
      disclosure.id !== record.disclosurePolicyId ||
      disclosure.revision !== record.disclosurePolicyRevision ||
      disclosure.status !== "active" ||
      disclosure.actorAccountId !== record.actorAccountId ||
      Date.parse(disclosure.publishedAt) > Date.parse(record.finalizedAt)
    )
      return new Error("record preservation proposal references do not match")
    return RecordPreservationProposalValue.restore({
      version: 1,
      operation: "system.record.preserve",
      recordId: record.id,
      source: record.source,
      actorAccountId: record.actorAccountId,
      reason: record.reason,
      attachmentId: record.attachmentId,
      attachmentDigest: record.attachmentDigest,
      sourceAuthorizationRef: record.sourceAuthorizationRef,
      preservation: {
        id: preservation.id,
        kind: preservation.kind,
        retainUntil: preservation.retainUntil,
        reason: preservation.reason,
      },
      disclosure: {
        id: disclosure.id,
        revision: disclosure.revision,
        reason: disclosure.reason,
        grants: disclosure.grants,
      },
    })
  }

  static async restore(input: unknown): Promise<RecordPreservationProposalValue | Error> {
    const parsed = recordPreservationIntentSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const source = PreservedRecordSourceValue.create(parsed.data.source)
    if (source instanceof Error) return source
    const retention = parsed.data.preservation
    if (
      (retention.kind === "hold" && retention.retainUntil !== null) ||
      (retention.kind === "retention" &&
        (retention.retainUntil === null ||
          Date.parse(retention.retainUntil) <= Date.parse(source.props.capturedAt)))
    )
      return new Error("invalid preservation intent period")
    const canonical = CanonicalSystemJsonValue.create({ ...parsed.data, source: source.props })
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    return new RecordPreservationProposalValue(Object.freeze({ canonical, digest }))
  }
  /** 検証済みの提案から保存内容を組み立てる。承認資格と実行許可は別途検査する。 */
  toFinalization(input: Readonly<{ actorAccountId: string; at: Date }>):
    | Readonly<{
        record: PreservedRecordEntity
        disclosure: PreservedRecordDisclosurePolicyEntity
        preservation: AttachmentPreservationEntity
      }>
    | Error {
    if (!Number.isSafeInteger(input.at.getTime())) return new Error("invalid record execution time")
    const parsed = recordPreservationIntentSchema.safeParse(
      JSON.parse(this.props.canonical.toString()),
    )
    if (!parsed.success) return parsed.error
    const intent = parsed.data
    if (intent.actorAccountId !== input.actorAccountId)
      return new Error("record execution actor differs from proposal")
    const at = input.at.toISOString()
    const record = PreservedRecordEntity.create({
      id: intent.recordId,
      source: intent.source,
      attachmentId: intent.attachmentId,
      attachmentDigest: intent.attachmentDigest,
      preservationId: intent.preservation.id,
      disclosurePolicyId: intent.disclosure.id,
      disclosurePolicyRevision: intent.disclosure.revision,
      sourceAuthorizationRef: intent.sourceAuthorizationRef,
      actorAccountId: input.actorAccountId,
      finalizedAt: at,
      reason: intent.reason,
      auditEventId: crypto.randomUUID(),
    })
    if (record instanceof Error) return record
    const preservation = AttachmentPreservationEntity.create({
      ...intent.preservation,
      attachmentId: intent.attachmentId,
      sha256: intent.attachmentDigest,
      actorAccountId: input.actorAccountId,
      createdAt: at,
      auditEventId: crypto.randomUUID(),
      revision: 1,
      release: null,
    })
    if (preservation instanceof Error) return preservation
    const disclosure = PreservedRecordDisclosurePolicyEntity.create({
      ...intent.disclosure,
      recordId: intent.recordId,
      status: "active",
      actorAccountId: input.actorAccountId,
      publishedAt: at,
      auditEventId: crypto.randomUUID(),
    })
    if (disclosure instanceof Error) return disclosure
    return Object.freeze({ record, disclosure, preservation })
  }
}
