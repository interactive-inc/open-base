import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { CompanyOperationError, CompanyUnavailableError } from "@/contexts/company/domain/errors"
import { companyEmploymentStateSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employment-state-sql"

export type LiveEmployeeAccess = {
  status: "ACTIVE" | "ON_LEAVE"
  source: "employment"
  businessDate: string
}

type Context = Readonly<{ env: CompanyContext["env"] }>
type EmploymentStateRow = Readonly<{
  employee_id: EmployeeId
  status: unknown
  employment_starts_on: string
  employment_ends_on: string | null
  status_starts_on: string | null
  status_ends_on: string | null
}>

/** 会社営業日に有効な雇用・状態の期間履歴からアクセス資格を解決する。 */
export class ResolveLiveEmployeeAccessAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async resolveLiveEmployeeAccess(
    employeeId: EmployeeId,
  ): Promise<LiveEmployeeAccess | null | CompanyOperationError> {
    const result = await this.resolveMany([employeeId])
    return result instanceof Error ? result : (result.get(employeeId) ?? null)
  }

  async resolveMany(
    employeeIds: ReadonlyArray<EmployeeId>,
    asOf?: CalendarDate,
  ): Promise<ReadonlyMap<EmployeeId, LiveEmployeeAccess | null> | CompanyOperationError> {
    if (employeeIds.length === 0) return new Map()
    const businessDate =
      asOf ??
      resolveCompanyBusinessDate({
        now: this.c.env.NOW ?? new Date().toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
    if (businessDate instanceof Error) {
      return new CompanyUnavailableError(
        "会社営業日を解決できません",
        "company_timezone_unavailable",
        { cause: businessDate },
      )
    }

    try {
      const states = await this.c.env.DB.prepare(
        `${companyEmploymentStateSql()}
         SELECT employee_id, status, employment_starts_on, employment_ends_on,
                status_starts_on, status_ends_on
         FROM current_employment_states
         WHERE employee_id IN (SELECT value FROM json_each(?2))
         ORDER BY employee_id, employment_id, status_period_id`,
      )
        .bind(businessDate, JSON.stringify([...new Set(employeeIds)]))
        .all<EmploymentStateRow>()
      if (!states.success) return this.unavailable()
      const results = new Map<EmployeeId, LiveEmployeeAccess | null>(
        employeeIds.map((id) => [id, null]),
      )
      for (const state of states.results) {
        if (
          !results.has(state.employee_id) ||
          results.get(state.employee_id) !== null ||
          !this.isValidState(state)
        )
          return this.unavailable()
        results.set(state.employee_id, {
          status: state.status === "active" ? "ACTIVE" : "ON_LEAVE",
          source: "employment",
          businessDate,
        })
      }
      return results
    } catch (cause) {
      return this.unavailable(cause)
    }
  }

  private isValidState(state: EmploymentStateRow): boolean {
    if (state.status !== "active" && state.status !== "leave") return false
    if (state.status_starts_on === null || state.status_starts_on < state.employment_starts_on)
      return false
    if (state.employment_ends_on === null) return true

    return state.status_ends_on !== null && state.status_ends_on <= state.employment_ends_on
  }

  private unavailable(cause?: unknown): CompanyUnavailableError {
    return new CompanyUnavailableError(
      "基準日現在の在籍状態を一意に解決できません",
      "lifecycle_projection_mismatch",
      { cause },
    )
  }
}
