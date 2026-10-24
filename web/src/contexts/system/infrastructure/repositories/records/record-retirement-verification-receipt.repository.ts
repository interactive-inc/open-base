import type { SystemD1Context } from "@system/configuration/system-context"
import { RecordRetirementVerificationReceiptEntity } from "@system/domain/entities/record-retirement-verification-receipt.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** ページ検査を監査と同時に保存し、計画内の連続した末尾から再開する。 */
export class RecordRetirementVerificationReceiptRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async append(
    receipt: RecordRetirementVerificationReceiptEntity,
  ): Promise<"written" | "conflict" | Error> {
    if (this.c.assertions.length === 0)
      return new Error("retirement receipt authorization required")
    const audit = receipt.audit()
    if (audit instanceof Error) return audit
    try {
      const statements = [
        ...this.c.assertions,
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
        this.c.env.DB.prepare(`INSERT INTO system_record_retirement_receipts
          (id,plan_id,ordinal,digest,coverage_page_id,audit_event_id,snapshot_json) VALUES (?1,?2,?3,?4,?5,?6,?7)`).bind(
          receipt.snapshot.id,
          receipt.snapshot.planId,
          receipt.snapshot.ordinal,
          receipt.digest,
          receipt.snapshot.coveragePageId,
          receipt.snapshot.auditEventId,
          JSON.stringify(receipt.snapshot),
        ),
        ...this.c.assertions,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("retirement receipt append failed")
      return "written"
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes("record_retirement_receipt_conflict"))
        return "conflict"
      return new Error("retirement receipt append failed", { cause })
    }
  }

  find(id: string) {
    return this.read(
      this.c.env.DB.prepare(
        "SELECT snapshot_json,digest FROM system_record_retirement_receipts WHERE id=?1",
      ).bind(id),
    )
  }

  findLatest(planId: string) {
    return this.read(
      this.c.env.DB.prepare(
        "SELECT snapshot_json,digest FROM system_record_retirement_receipts WHERE plan_id=?1 ORDER BY ordinal DESC LIMIT 1",
      ).bind(planId),
    )
  }

  private async read(
    query: D1PreparedStatement,
  ): Promise<RecordRetirementVerificationReceiptEntity | null | Error> {
    if (this.c.assertions.length === 0)
      return new Error("retirement receipt authorization required")
    try {
      const statements = [...this.c.assertions, query, ...this.c.assertions]
      const results = await this.c.env.DB.batch<{ snapshot_json: string; digest: string }>(
        statements,
      )
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("retirement receipt read failed")
      const row = results[this.c.assertions.length]?.results[0]
      if (row === undefined) return null
      return RecordRetirementVerificationReceiptEntity.restore(
        JSON.parse(row.snapshot_json),
        row.digest,
      )
    } catch (cause) {
      return new Error("retirement receipt read failed", { cause })
    }
  }
}
