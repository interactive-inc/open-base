import { z } from "zod"
import type { SystemD1Context } from "@system/configuration/system-context"
import { AttachmentKekFingerprintAdapter } from "@system/infrastructure/adapters/attachments/attachment-kek-fingerprint.adapter"
import { RecordCoveragePageRepository } from "@system/infrastructure/repositories/records/record-coverage-page.repository"

type Context = SystemD1Context &
  Readonly<{
    env: Readonly<{ ATTACHMENT_KEKS?: string }>
    assertions: ReadonlyArray<D1PreparedStatement>
  }>
const versionsSql = `SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
  JOIN json_each(page.snapshot_json,'$.records') item
  JOIN system_preserved_records record ON record.id=json_extract(item.value,'$.preservedRecordId')
  JOIN system_attachments attachment ON attachment.id=record.attachment_id WHERE page.id=?1
  UNION SELECT attachment.kek_version AS version FROM system_record_coverage_pages page
  JOIN json_each(page.snapshot_json,'$.records') item
  JOIN system_attachments attachment ON attachment.id=json_extract(item.value,'$.source.recordId')
  WHERE page.id=?1 AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
  ORDER BY version`

/** 検査ページの保全本文と元添付に使用する鍵の版を固定し、その設定のdigestを求める。 */
export class PrepareRecordRetirementPageKeysAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(pageId: string) {
    const page = await new RecordCoveragePageRepository(this.c).find(pageId)
    if (page instanceof Error) return page
    if (page === null) return new Error("retirement coverage page missing")
    try {
      const statements = [
        ...this.c.assertions,
        this.c.env.DB.prepare(versionsSql).bind(pageId),
        ...this.c.assertions,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("retirement storage key lookup failed")
      const rows = z
        .array(z.object({ version: z.number().int().positive().safe() }))
        .parse(results[this.c.assertions.length]?.results)
      const versions = rows.map((row) => row.version)
      const storageKeys = await new AttachmentKekFingerprintAdapter(this.c).prepare(versions)
      if (storageKeys instanceof Error) return storageKeys
      const guard =
        this.c.env.DB.prepare(`SELECT CASE WHEN (SELECT json_group_array(version) FROM (${versionsSql})) IS ?2
        THEN 1 ELSE json_extract('{}','retirement_storage_versions_changed') END`).bind(
          pageId,
          JSON.stringify(versions),
        )
      return Object.freeze({
        storageKeys,
        assertions: Object.freeze([...this.c.assertions, guard]),
      })
    } catch (cause) {
      return new Error("retirement storage keys unavailable", { cause })
    }
  }
}
