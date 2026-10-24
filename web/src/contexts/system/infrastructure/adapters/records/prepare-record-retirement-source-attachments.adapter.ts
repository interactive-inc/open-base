import type { SystemD1Context } from "@system/configuration/system-context"
import { PrepareRecordRetirementCoverageAdapter } from "@system/infrastructure/adapters/records/prepare-record-retirement-coverage.adapter"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** 検査した原添付が同じ停止世代で保護されていることを検査する。ストレージ本体の再取得は行わない。 */
export class PrepareRecordRetirementSourceAttachmentsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const coverage = await new PrepareRecordRetirementCoverageAdapter(this.c).prepare(input)
    if (coverage instanceof Error) return coverage
    const guard = this.c.env.DB.prepare(`SELECT CASE WHEN NOT EXISTS (
      SELECT 1 FROM system_record_retirement_receipts receipt
      JOIN system_record_coverage_pages page ON page.id=receipt.coverage_page_id
      JOIN json_each(page.snapshot_json,'$.records') item
      LEFT JOIN system_record_retirement_attachment_pins pin ON pin.receipt_id=receipt.id
        AND pin.attachment_id IS json_extract(item.value,'$.source.recordId')
      LEFT JOIN system_attachments attachment ON attachment.id=pin.attachment_id
      WHERE receipt.plan_id=?1 AND json_extract(item.value,'$.source.formatId')='system-attachment-record'
        AND (json_extract(item.value,'$.source.formatVersion') IS NOT 1
          OR pin.receipt_id IS NULL OR attachment.id IS NULL OR attachment.status<>'linked'
          OR attachment.wrapped_dek IS NULL OR attachment.wrapped_dek_iv IS NULL OR attachment.erased_at IS NOT NULL)
    ) THEN 1 ELSE json_extract('{}','record_retirement_source_attachment_changed') END`).bind(
      coverage.planId,
    )
    const assertions = Object.freeze([...coverage.assertions, guard])
    try {
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement source attachments unavailable")
      return Object.freeze({ coverage, assertions })
    } catch (cause) {
      return new Error("retirement source attachments unavailable", { cause })
    }
  }
}
