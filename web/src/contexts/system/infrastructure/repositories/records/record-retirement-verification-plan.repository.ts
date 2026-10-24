import type { SystemD1Context } from "@system/configuration/system-context"
import { RecordRetirementVerificationPlanEntity } from "@system/domain/entities/record-retirement-verification-plan.entity"
import { SystemAuditEventRepository } from "@system/infrastructure/repositories/audit/system-audit-event.repository"

type Context = SystemD1Context & Readonly<{ assertions: ReadonlyArray<D1PreparedStatement> }>

/** 検査対象を監査と同時に固定し、再開時に保存した計画のdigestを検査する。 */
export class RecordRetirementVerificationPlanRepository {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async append(
    plan: RecordRetirementVerificationPlanEntity,
  ): Promise<"written" | "conflict" | Error> {
    if (this.c.assertions.length === 0) return new Error("retirement plan authorization required")
    const audit = plan.audit()
    if (audit instanceof Error) return audit
    try {
      const statements = [
        ...this.c.assertions,
        ...new SystemAuditEventRepository(this.c).prepareAppend(audit),
        this.c.env.DB.prepare(`INSERT INTO system_record_retirement_plans
          (id,freeze_id,digest,audit_event_id,snapshot_json) VALUES (?1,?2,?3,?4,?5)`).bind(
          plan.snapshot.id,
          plan.snapshot.freezeId,
          plan.digest,
          plan.snapshot.auditEventId,
          JSON.stringify(plan.snapshot),
        ),
        ...this.c.assertions,
      ]
      const results = await this.c.env.DB.batch(statements)
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("retirement plan append failed")
      return "written"
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes("record_retirement_plan_conflict"))
        return "conflict"
      return new Error("retirement plan append failed", { cause })
    }
  }

  async find(id: string): Promise<RecordRetirementVerificationPlanEntity | null | Error> {
    if (this.c.assertions.length === 0) return new Error("retirement plan authorization required")
    try {
      const statements = [
        ...this.c.assertions,
        this.c.env.DB.prepare(
          "SELECT snapshot_json,digest FROM system_record_retirement_plans WHERE id=?1",
        ).bind(id),
        ...this.c.assertions,
      ]
      const results = await this.c.env.DB.batch<{ snapshot_json: string; digest: string }>(
        statements,
      )
      if (results.length !== statements.length || results.some((result) => !result.success))
        return new Error("retirement plan read failed")
      const row = results[this.c.assertions.length]?.results[0]
      if (row === undefined) return null
      return RecordRetirementVerificationPlanEntity.restore(
        JSON.parse(row.snapshot_json),
        row.digest,
      )
    } catch (cause) {
      return new Error("retirement plan read failed", { cause })
    }
  }
}
