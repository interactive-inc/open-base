import { z } from "zod"
import { CompanyUnavailableError } from "@/contexts/company/domain/errors"
import { GradeAwardSourceSnapshotValue } from "@/contexts/company/domain/values/grade-award-source-snapshot.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Context = Readonly<{ env: Readonly<{ DB: D1Database }> }>
const recordSchema = z.object({
  command_id: z.string(),
  employee_id: z.string(),
  fingerprint: z.string(),
  actor_account_id: z.string(),
  reason: z.string(),
  observed_on: z.string().date(),
  observed_company_revision: z.number().int().nonnegative(),
  snapshot_digest: z.string(),
  source_json: z.string(),
  recorded_at: z.number().int().nonnegative(),
})

/** 旧台帳に依存せず、保全済みの等級付与原文と主体を取得する。 */
export class GradeAwardArchiveReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async find(commandId: string) {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT * FROM company_grade_award_archives WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND command_id = ?1`,
      )
        .bind(commandId)
        .first()
      if (row === null) return null
      const record = recordSchema.parse(row)
      const source = await GradeAwardSourceSnapshotValue.create(record.source_json)
      if (source instanceof Error) return this.unavailable(source)
      if (
        source.props.digest !== record.snapshot_digest ||
        source.props.value.employeeId !== record.employee_id ||
        source.props.value.organizationRevision !== record.observed_company_revision
      )
        return this.unavailable(new Error("archive evidence mismatch"))
      return {
        commandId: record.command_id,
        employeeId: record.employee_id,
        actorAccountId: record.actor_account_id,
        reason: record.reason,
        observedOn: record.observed_on,
        observedCompanyRevision: record.observed_company_revision,
        recordedAt: record.recorded_at,
        snapshotDigest: record.snapshot_digest,
        source: source.props.value,
      }
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  async findByEmployee(employeeId: string) {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT command_id FROM company_grade_award_archives WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND employee_id = ?1`,
      )
        .bind(employeeId)
        .first<{ command_id: string }>()
      if (row === null) return null
      return this.find(row.command_id)
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private unavailable(cause: unknown) {
    return new CompanyUnavailableError(
      "等級付与の原記録を取得できませんでした",
      "grade_award_archive_unavailable",
      { cause },
    )
  }
}
