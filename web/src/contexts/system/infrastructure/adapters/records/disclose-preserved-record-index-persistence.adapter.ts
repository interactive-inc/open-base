import type { z } from "zod"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { preservedRecordSearchSchema } from "@system/domain/schemas/records/preserved-record-search.schema"
import type { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"
import type { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { SearchPreservedRecordsAdapter } from "@system/infrastructure/adapters/records/search-preserved-records.adapter"
import { PreservedRecordDisclosurePolicyRepository } from "@system/infrastructure/repositories/records/preserved-record-disclosure-policy.repository"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context &
  Readonly<{
    authorizationAssertions: (at: Date) => ReadonlyArray<D1PreparedStatement> | Error
  }>
type Search = z.output<typeof preservedRecordSearchSchema> & Readonly<{ accountId: string }>

/** 開示資格の再検査と一覧の閲覧監査を同じtransactionで確定する。 */
export class DisclosePreservedRecordIndexPersistenceAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findCandidates(search: Search, after: string | null, at: Date) {
    const assertions = this.c.authorizationAssertions(at)
    if (assertions instanceof Error) return assertions
    return new SearchPreservedRecordsAdapter({ env: this.c.env, assertions }).findCandidates(
      search,
      after,
    )
  }

  async write(
    input: Readonly<{
      policies: ReadonlyArray<PreservedRecordDisclosurePolicyEntity>
      accountId: string
      action: "read" | "export"
      purpose: string
      at: Date
      audit: SystemAuditEventEntity
    }>,
  ) {
    const assertions = this.c.authorizationAssertions(input.at)
    if (assertions instanceof Error) return assertions
    if (assertions.length === 0) return new Error("record authorization is required")
    const guards = [...assertions]
    const repository = new PreservedRecordDisclosurePolicyRepository({
      env: this.c.env,
      assertions: [],
    })
    for (const policy of input.policies) {
      const policyGuards = repository.prepareDisclosureGuard(policy, {
        recordId: policy.snapshot.recordId,
        accountId: input.accountId,
        action: input.action,
        purpose: input.purpose,
        at: input.at,
      })
      if (policyGuards instanceof Error) return policyGuards
      guards.push(...policyGuards, this.preparePeriodGuard(policy, input))
    }
    return new SystemAuditEventRepository(this.c).append(input.audit, guards)
  }

  /** アプリで許可した後にも、最終保存のDB時刻で同じ主体・操作・目的の期間を検査する。 */
  private preparePeriodGuard(
    policy: PreservedRecordDisclosurePolicyEntity,
    input: Readonly<{ accountId: string; action: "read" | "export"; purpose: string; at: Date }>,
  ): D1PreparedStatement {
    return this.c.env.DB.prepare(`WITH evaluation AS (
      SELECT max(?6, CAST(round((julianday('now') - 2440587.5) * 86400000) AS INTEGER)) AS at
    ) SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_record_disclosure_policies p, json_each(p.snapshot_json, '$.grants') grant_entry
      WHERE p.id = ?1 AND p.revision = ?2 AND json_extract(p.snapshot_json, '$.status') = 'active'
        AND round((julianday(json_extract(p.snapshot_json, '$.publishedAt')) - 2440587.5) * 86400000) <= (SELECT at FROM evaluation)
        AND json_extract(grant_entry.value, '$.accountId') = ?3
        AND EXISTS (SELECT 1 FROM json_each(grant_entry.value, '$.actions') WHERE value = ?4)
        AND EXISTS (SELECT 1 FROM json_each(grant_entry.value, '$.purposes') WHERE value = ?5)
        AND round((julianday(json_extract(grant_entry.value, '$.validFrom')) - 2440587.5) * 86400000) <= (SELECT at FROM evaluation)
        AND (json_extract(grant_entry.value, '$.validUntil') IS NULL OR
          round((julianday(json_extract(grant_entry.value, '$.validUntil')) - 2440587.5) * 86400000) > (SELECT at FROM evaluation))
    ) THEN 1 ELSE json_extract('{}', 'record_index_disclosure_expired') END`).bind(
      policy.snapshot.id,
      policy.snapshot.revision,
      input.accountId,
      input.action,
      input.purpose,
      input.at.getTime(),
    )
  }
}
