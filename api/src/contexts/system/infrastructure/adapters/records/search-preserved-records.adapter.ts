import type { z } from "zod"
import type { SystemD1Context } from "@system/configuration/system-context"
import type { preservedRecordSearchSchema } from "@system/domain/schemas/records/preserved-record-search.schema"
import { PreservedRecordEntity } from "@system/domain/entities/preserved-record.entity"
import { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>
type Search = z.output<typeof preservedRecordSearchSchema> & Readonly<{ accountId: string }>

/** 候補を小分けに取得し、期限を含む最終的な開示判定はDomainへ委ねる。 */
export class SearchPreservedRecordsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findCandidates(search: Search, after: string | null) {
    if (this.c.assertions.length === 0) return new Error("record authorization is required")
    const query = this.c.env.DB.prepare(`
      SELECT r.id, r.snapshot_json AS record_json, p.snapshot_json AS policy_json
      FROM system_preserved_records r
      JOIN system_record_disclosure_policies p ON p.id = r.disclosure_policy_id AND p.record_id = r.id
      WHERE NOT EXISTS (
        SELECT 1 FROM system_record_disclosure_policies newer
        WHERE newer.id = p.id AND newer.revision > p.revision
      )
      AND (?1 IS NULL OR r.id > ?1)
      AND (?2 IS NULL OR json_extract(r.snapshot_json, '$.source.sourceNamespace') = ?2)
      AND (?3 IS NULL OR json_extract(r.snapshot_json, '$.source.ownerContext') = ?3)
      AND (?4 IS NULL OR json_extract(r.snapshot_json, '$.source.recordKind') = ?4)
      AND (?5 IS NULL OR json_extract(r.snapshot_json, '$.source.recordId') = ?5)
      AND json_extract(p.snapshot_json, '$.status') = 'active'
      AND EXISTS (
        SELECT 1 FROM json_each(p.snapshot_json, '$.grants') grant_entry
        WHERE json_extract(grant_entry.value, '$.accountId') = ?6
        AND EXISTS (SELECT 1 FROM json_each(grant_entry.value, '$.actions') a WHERE a.value = ?7)
        AND EXISTS (SELECT 1 FROM json_each(grant_entry.value, '$.purposes') purpose WHERE purpose.value = ?8)
      )
      ORDER BY r.id ASC LIMIT 51
    `).bind(
      after,
      search.sourceNamespace,
      search.ownerContext,
      search.recordKind,
      search.sourceRecordId,
      search.accountId,
      search.action,
      search.purpose,
    )
    try {
      const statements = [...this.c.assertions, query]
      const batch = await this.c.env.DB.batch<{
        id: string
        record_json: string
        policy_json: string
      }>(statements)
      if (batch.length !== statements.length || batch.some((result) => !result.success))
        return new Error("preserved record search failed")
      const rows = batch.at(-1)?.results
      if (rows === undefined) return new Error("preserved record search result is missing")
      const candidates = []
      for (const row of rows) {
        const record = PreservedRecordEntity.create(JSON.parse(row.record_json))
        const policy = PreservedRecordDisclosurePolicyEntity.create(JSON.parse(row.policy_json))
        if (record instanceof Error || policy instanceof Error)
          return new Error("stored preserved record search result is invalid")
        if (
          record.snapshot.id !== row.id ||
          policy.snapshot.recordId !== row.id ||
          policy.snapshot.id !== record.snapshot.disclosurePolicyId
        )
          return new Error("stored preserved record disclosure does not match")
        candidates.push(Object.freeze({ record, policy }))
      }
      return Object.freeze(candidates)
    } catch (cause) {
      return new Error("preserved record search failed", { cause })
    }
  }
}
