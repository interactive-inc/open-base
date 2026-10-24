import { z } from "zod"
import type { SystemD1Context } from "@system/configuration/system-context"
import { RecordRetirementVerificationPlanRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-plan.repository"
import { RecordRetirementVerificationReceiptRepository } from "@system/infrastructure/repositories/records/record-retirement-verification-receipt.repository"
import { RecordSourceFreezeRepository } from "@system/infrastructure/repositories/records/record-source-freeze.repository"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>
const completedSql = `SELECT 1 FROM system_record_retirement_plans plan
  JOIN system_record_source_freezes freeze ON freeze.id=plan.freeze_id AND freeze.revision=1
  JOIN system_record_retirement_receipts terminal ON terminal.plan_id=plan.id AND terminal.ordinal=?3
  WHERE plan.id=?1 AND plan.digest=?2 AND plan.snapshot_json IS ?6
    AND terminal.id=?4 AND terminal.digest=?5
    AND (SELECT count(*) FROM system_record_retirement_receipts WHERE plan_id=plan.id)=?3
    AND NOT EXISTS (
      SELECT 1 FROM system_record_retirement_receipts current
      LEFT JOIN system_record_retirement_receipts previous ON previous.plan_id=current.plan_id AND previous.ordinal=current.ordinal-1
      LEFT JOIN system_record_coverage_pages page ON page.id=current.coverage_page_id
      WHERE current.plan_id=plan.id AND (
        json_extract(current.snapshot_json,'$.planDigest') IS NOT plan.digest
        OR page.id IS NULL OR page.freeze_id IS NOT plan.freeze_id
        OR page.digest IS NOT json_extract(current.snapshot_json,'$.coveragePageDigest')
        OR (current.ordinal=1 AND json_type(current.snapshot_json,'$.previousReceiptDigest') IS NOT 'null')
        OR (current.ordinal>1 AND (previous.id IS NULL
          OR previous.digest IS NOT json_extract(current.snapshot_json,'$.previousReceiptDigest')
          OR julianday(json_extract(current.snapshot_json,'$.checkedAt')) < julianday(json_extract(previous.snapshot_json,'$.checkedAt'))))
      )
    )`

/** 固定した計画の検査結果が先頭から終端まで揃うことを検査する。現在の保持状態と撤去許可は表さない。 */
export class PrepareRecordRetirementCoverageAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(input: unknown) {
    const parsed = z
      .strictObject({ planId: z.uuid(), planDigest: z.string().regex(/^[0-9a-f]{64}$/) })
      .safeParse(input)
    if (!parsed.success) return parsed.error
    if (this.c.assertions.length === 0)
      return new Error("retirement coverage authorization required")
    const plan = await new RecordRetirementVerificationPlanRepository(this.c).find(
      parsed.data.planId,
    )
    if (plan instanceof Error) return plan
    if (plan === null || plan.digest !== parsed.data.planDigest)
      return new Error("retirement plan differs")
    const generation = await new RecordSourceFreezeRepository(this.c).prepareActiveGeneration({
      id: plan.snapshot.freezeId,
      sourceNamespace: plan.snapshot.sourceNamespace,
      ownerContext: plan.snapshot.ownerContext,
    })
    if (generation instanceof Error) return generation
    const terminal = await new RecordRetirementVerificationReceiptRepository({
      env: this.c.env,
      assertions: generation.assertions,
    }).findLatest(plan.snapshot.id)
    if (terminal instanceof Error) return terminal
    if (
      terminal === null ||
      terminal.snapshot.ordinal !== plan.totalPages ||
      terminal.snapshot.planDigest !== plan.digest
    )
      return new Error("retirement verification is incomplete")
    const guard = this.c.env.DB.prepare(`SELECT CASE WHEN EXISTS (${completedSql}) THEN 1
      ELSE json_extract('{}','retirement_verification_changed') END`).bind(
      plan.snapshot.id,
      plan.digest,
      plan.totalPages,
      terminal.snapshot.id,
      terminal.digest,
      JSON.stringify(plan.snapshot),
    )
    const assertions = Object.freeze([...generation.assertions, guard])
    try {
      const checked = await this.c.env.DB.batch([...assertions])
      if (checked.length !== assertions.length || checked.some((check) => !check.success))
        return new Error("retirement verification coverage unavailable")
      return Object.freeze({
        planId: plan.snapshot.id,
        planDigest: plan.digest,
        totalPages: plan.totalPages,
        terminalReceiptId: terminal.snapshot.id,
        terminalReceiptDigest: terminal.digest,
        checkedThrough: terminal.snapshot.checkedAt,
        assertions,
      })
    } catch (cause) {
      return new Error("retirement verification coverage unavailable", { cause })
    }
  }
}
