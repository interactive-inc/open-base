import { z } from "zod"
import type { SystemD1Context } from "@system/configuration/system-context"
import { AttachmentKekFingerprintAdapter } from "@system/infrastructure/adapters/attachments/attachment-kek-fingerprint.adapter"
import { PrepareRecordRetirementCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-coverage.adapter"

type Context = SystemD1Context &
  Readonly<{
    env: Readonly<{ ATTACHMENT_KEKS?: string }>
    assertions: ReadonlyArray<D1PreparedStatement>
  }>

/** ページ検査時に使った鍵が現在も同じ設定で存在することを確認する。未使用の鍵の追加は妨げない。 */
export class PrepareRecordRetirementStorageKeysAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const coverage = await new PrepareRecordRetirementCoverageAdapter(this.c).prepare(input)
    if (coverage instanceof Error) return coverage
    try {
      const statements = [
        ...coverage.assertions,
        this.c.env.DB.prepare(`SELECT DISTINCT json_extract(key.value,'$.version') AS version
        FROM system_record_retirement_receipts receipt, json_each(receipt.snapshot_json,'$.storageKeys') key
        WHERE receipt.plan_id=?1 ORDER BY version`).bind(coverage.planId),
        ...coverage.assertions,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("retirement storage key lookup failed")
      const rows = z
        .array(z.object({ version: z.number().int().positive().safe() }))
        .parse(results[coverage.assertions.length]?.results)
      const fingerprints = await new AttachmentKekFingerprintAdapter(this.c).prepare(
        rows.map((row) => row.version),
      )
      if (fingerprints instanceof Error) return fingerprints
      const guard = this.c.env.DB.prepare(`SELECT CASE WHEN NOT EXISTS (
        SELECT 1 FROM system_record_retirement_receipts receipt WHERE receipt.plan_id=?1
          AND (json_type(receipt.snapshot_json,'$.storageKeys') IS NOT 'array' OR EXISTS (
            SELECT 1 FROM json_each(receipt.snapshot_json,'$.storageKeys') expected WHERE NOT EXISTS (
              SELECT 1 FROM json_each(?2) current
              WHERE json_extract(current.value,'$.version') IS json_extract(expected.value,'$.version')
                AND json_extract(current.value,'$.digest') IS json_extract(expected.value,'$.digest')
            )
          ))
      ) THEN 1 ELSE json_extract('{}','retirement_storage_keys_changed') END`).bind(
        coverage.planId,
        JSON.stringify(fingerprints),
      )
      const assertions = Object.freeze([...coverage.assertions, guard])
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement storage keys changed")
      return Object.freeze({ coverage, assertions })
    } catch (cause) {
      return new Error("retirement storage keys unavailable", { cause })
    }
  }
}
