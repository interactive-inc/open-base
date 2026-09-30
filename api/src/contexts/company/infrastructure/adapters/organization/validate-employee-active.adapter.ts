import { ReadWorkforceState } from "@/contexts/company/lib/workforce/read-workforce-state"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { EmployeeLifecycleWorkforceAdapter } from "@/contexts/company/infrastructure/adapters/workforce/employee-lifecycle-workforce.adapter"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyUnavailableError } from "@/contexts/company/domain/errors"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type EmployeeActiveResult =
  | { valid: true }
  | {
      valid: false
      code: "not_found" | "archived" | "not_active" | "retired" | "department_archived"
      message: string
    }

/** canonical Workforce snapshotだけから指定時点の在籍有効性を検証する。 */
async function validateEmployeeActive(
  c: CompanyContext,
  employeeId: EmployeeId,
  businessDate: string,
): Promise<EmployeeActiveResult | Error> {
  const state = await new ReadWorkforceState({
    workforce: new EmployeeLifecycleWorkforceAdapter(c),
    organization: new OrganizationUnitReadAdapter(c.var.database),
  }).execute({
    employeeId,
    asOf: restoreCalendarDate(businessDate),
  })
  if (state.kind === "not_found") {
    return { valid: false, code: "not_found", message: "employee not found" }
  }
  if (state.kind !== "found") {
    return new CompanyUnavailableError(
      "Company workforceを検証できません",
      "company_workforce_unavailable",
      state.kind === "unavailable" ? { cause: state.cause } : { cause: state.error },
    )
  }
  if (state.state.status !== "ACTIVE" && state.state.status !== "ON_LEAVE") {
    return { valid: false, code: "not_active", message: "employee is not active" }
  }

  return { valid: true }
}
type Context = CompanyContext

export class ValidateEmployeeActiveAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async validateEmployeeActive(
    employeeId: EmployeeId,
    businessDate: string,
  ): Promise<EmployeeActiveResult | Error> {
    return validateEmployeeActive(this.c, employeeId, businessDate)
  }
}
