import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { preservedRecordSearchSchema } from "@system/domain/schemas/records/preserved-record-search.schema"
import type { DisclosePreservedRecordIndexPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-index-persistence.adapter"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import type { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import type { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"

type Context = Readonly<{
  accountId: string
  now: () => Date
  persistence: DisclosePreservedRecordIndexPersistenceAdapter
}>
type Candidate = Readonly<{
  record: PreservedRecordEntity
  policy: PreservedRecordDisclosurePolicyEntity
}>

/** 現在の資格で開示できる原記録を探し、閲覧監査を確定してから一覧を返す。 */
export class DisclosePreservedRecordIndex {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(input: unknown) {
    const parsed = preservedRecordSearchSchema.safeParse(input)
    if (!parsed.success) return parsed.error
    const search = { ...parsed.data, accountId: this.c.accountId }
    const at = this.c.now()
    const page: { after: string | null; complete: boolean; permitted: Candidate[] } = {
      after: search.after,
      complete: false,
      permitted: [],
    }
    while (!page.complete && page.permitted.length <= search.limit) {
      const candidates = await this.c.persistence.findCandidates(search, page.after, at)
      if (candidates instanceof Error) return candidates
      page.complete = candidates.length < 51
      for (const candidate of candidates) {
        page.after = candidate.record.snapshot.id
        if (
          candidate.policy.permits({
            recordId: candidate.record.snapshot.id,
            accountId: this.c.accountId,
            action: search.action,
            purpose: search.purpose,
            at,
          })
        )
          page.permitted.push(candidate)
        if (page.permitted.length > search.limit) break
      }
    }
    const now = this.c.now()
    const records = page.permitted.slice(0, search.limit).map((candidate) => ({
      recordId: candidate.record.snapshot.id,
      source: candidate.record.source.props,
      finalizedAt: candidate.record.snapshot.finalizedAt,
    }))
    const nextCursor =
      page.permitted.length > search.limit ? (records.at(-1)?.recordId ?? null) : null
    const audit = SystemAuditEventEntity.create({
      actorAccountId: this.c.accountId,
      action: SYSTEM_AUDIT_ACTIONS.systemRecordSearched,
      targetType: "system:preserved-record-search",
      targetId: this.c.accountId,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: JSON.stringify({ action: search.action, purpose: search.purpose }),
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({
        recordIds: records.map((record) => record.recordId),
        nextCursor,
      }),
      occurredAt: now,
    })
    if (audit instanceof Error) return audit
    const written = await this.c.persistence.write({
      policies: page.permitted.map((candidate) => candidate.policy),
      accountId: this.c.accountId,
      action: search.action,
      purpose: search.purpose,
      at: now,
      audit,
    })
    if (written instanceof Error) return written
    return Object.freeze({ records, nextCursor })
  }
}
