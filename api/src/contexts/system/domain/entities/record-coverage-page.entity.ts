import { z } from "zod"
import { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

const pageSchema = z.strictObject({
  id: z.uuid(),
  freezeId: z.uuid(),
  sourceNamespace: z.string().regex(/^\S{1,255}$/),
  ownerContext: z.string().regex(/^[a-z][a-z0-9-]{0,99}$/),
  recordKind: z.string().regex(/^[a-z][a-z0-9_.:-]{0,199}$/),
  sequence: z.number().int().positive().safe(),
  previousDigest: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
  afterCursor: z.string().min(1).max(1000).nullable(),
  nextCursor: z.string().min(1).max(1000).nullable(),
  purpose: z.string().trim().min(1).max(255),
  checkedAt: z.string().datetime(),
  actorAccountId: z.string().min(1).max(255),
  records: z
    .array(z.strictObject({ preservedRecordId: z.uuid(), source: z.unknown() }))
    .max(100)
    .readonly(),
})

type Snapshot = z.output<typeof pageSchema>

/** 照合済みページの順序・保存元・保全先を固定し、ページ飛ばしと同一ページ内の重複を拒否する。 */
export class RecordCoveragePageEntity {
  private constructor(
    readonly snapshot: Readonly<Snapshot>,
    readonly digest: string,
  ) {
    Object.freeze(this)
  }

  static async create(
    input: unknown,
    previous: RecordCoveragePageEntity | null,
  ): Promise<RecordCoveragePageEntity | Error> {
    const entity = await this.restoreUnlinked(input)
    if (entity instanceof Error) return entity
    const page = entity.snapshot
    if (previous === null) {
      if (page.sequence !== 1 || page.previousDigest !== null || page.afterCursor !== null)
        return new Error("coverage must begin at the first page")
    } else {
      const before = previous.snapshot
      if (
        page.id === before.id ||
        before.nextCursor === null ||
        page.sequence !== before.sequence + 1 ||
        page.previousDigest !== previous.digest ||
        page.afterCursor !== before.nextCursor ||
        page.freezeId !== before.freezeId ||
        page.sourceNamespace !== before.sourceNamespace ||
        page.ownerContext !== before.ownerContext ||
        page.recordKind !== before.recordKind ||
        page.purpose !== before.purpose ||
        Date.parse(page.checkedAt) < Date.parse(before.checkedAt)
      )
        return new Error("coverage page does not continue the same source scan")
    }
    return entity
  }

  /** 保存された単一ページの内容hashを検査する。前後関係はDBの連続性制約が保証する。 */
  static async restore(
    input: unknown,
    expectedDigest: string,
  ): Promise<RecordCoveragePageEntity | Error> {
    const entity = await this.restoreUnlinked(input)
    if (entity instanceof Error) return entity
    return entity.digest === expectedDigest
      ? entity
      : new Error("stored coverage page digest mismatch")
  }

  private static async restoreUnlinked(input: unknown): Promise<RecordCoveragePageEntity | Error> {
    const parsed = pageSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const page = parsed.data
    if (
      page.sequence === 1
        ? page.previousDigest !== null || page.afterCursor !== null
        : page.previousDigest === null || page.afterCursor === null
    )
      return new Error("invalid coverage page position")
    if (
      page.actorAccountId.trim().length === 0 ||
      (page.records.length === 0 && page.nextCursor !== null)
    )
      return new Error("invalid coverage page")
    if (page.nextCursor !== null && page.nextCursor === page.afterCursor)
      return new Error("coverage cursor did not advance")
    const identities = new Set<string>()
    const preservedIds = new Set<string>()
    const records = []
    for (const record of page.records) {
      const source = PreservedRecordSourceValue.create(record.source)
      if (source instanceof Error) return source
      if (
        source.props.sourceNamespace !== page.sourceNamespace ||
        source.props.ownerContext !== page.ownerContext ||
        source.props.recordKind !== page.recordKind ||
        Date.parse(source.props.capturedAt) > Date.parse(page.checkedAt) ||
        identities.has(source.props.recordId) ||
        preservedIds.has(record.preservedRecordId)
      )
        return new Error("coverage source is duplicated or mismatched")
      identities.add(source.props.recordId)
      preservedIds.add(record.preservedRecordId)
      records.push(
        Object.freeze({ preservedRecordId: record.preservedRecordId, source: source.props }),
      )
    }
    const snapshot = Object.freeze({ ...page, records: Object.freeze(records) })
    const canonical = CanonicalSystemJsonValue.create(snapshot)
    if (canonical instanceof Error) return canonical
    const digest = await ProposalDigestValue.create(canonical)
    if (digest instanceof Error) return digest
    return new RecordCoveragePageEntity(snapshot, digest.toString())
  }
}
