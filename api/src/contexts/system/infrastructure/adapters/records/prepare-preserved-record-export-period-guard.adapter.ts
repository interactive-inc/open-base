import type { SystemD1Context } from "@system/configuration/system-context"
import type { PreservedRecordDisclosurePolicyEntity } from "@system/domain/entities/preserved-record-disclosure-policy.entity"

type Context = SystemD1Context

/** 原文の出力可能期間を、最終transactionのDB時刻でもミリ秒単位で検査する。 */
export class PreparePreservedRecordExportPeriodGuardAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  prepare(
    input: Readonly<{
      policy: PreservedRecordDisclosurePolicyEntity
      accountId: string
      purpose: string
      at: Date
    }>,
  ) {
    return this.c.env.DB.prepare(`WITH evaluation AS (
      SELECT max(?5, CAST(round((julianday('now') - 2440587.5) * 86400000) AS INTEGER)) AS at
    ) SELECT CASE WHEN EXISTS (
      SELECT 1 FROM system_record_disclosure_policies p, json_each(p.snapshot_json, '$.grants') grant_entry
      WHERE p.id = ?1 AND p.revision = ?2 AND json_extract(p.snapshot_json, '$.status') = 'active'
        AND round((julianday(json_extract(p.snapshot_json, '$.publishedAt')) - 2440587.5) * 86400000) <= (SELECT at FROM evaluation)
        AND json_extract(grant_entry.value, '$.accountId') = ?3
        AND EXISTS (SELECT 1 FROM json_each(grant_entry.value, '$.actions') WHERE value = 'export')
        AND EXISTS (SELECT 1 FROM json_each(grant_entry.value, '$.purposes') WHERE value = ?4)
        AND round((julianday(json_extract(grant_entry.value, '$.validFrom')) - 2440587.5) * 86400000) <= (SELECT at FROM evaluation)
        AND (json_extract(grant_entry.value, '$.validUntil') IS NULL OR
          round((julianday(json_extract(grant_entry.value, '$.validUntil')) - 2440587.5) * 86400000) > (SELECT at FROM evaluation))
    ) THEN 1 ELSE json_extract('{}', 'record_dossier_disclosure_expired') END`).bind(
      input.policy.snapshot.id,
      input.policy.snapshot.revision,
      input.accountId,
      input.purpose,
      input.at.getTime(),
    )
  }
}
