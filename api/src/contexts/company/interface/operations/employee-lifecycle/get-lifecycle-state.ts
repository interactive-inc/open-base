import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { ReadWorkforceState } from "@/contexts/company/lib/workforce/read-workforce-state"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { EmployeeLifecycleReadAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle-read.adapter"
import type { EmployeeLifecycleState } from "@/contexts/company/lib/workforce/employee-lifecycle-state"
import { EmployeeLifecycleWorkforceAdapter } from "@/contexts/company/infrastructure/adapters/workforce/employee-lifecycle-workforce.adapter"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { toEmployeeLifecycleState } from "@/contexts/company/lib/workforce/to-employee-lifecycle-state"
import {
  CompanyOperationError,
  CompanyNotFoundError,
  CompanyUnexpectedError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

export class GetLifecycleState {
  constructor(private readonly c: CompanyContext) {
    Object.freeze(this)
  }

  async run(props: {
    employeeId: EmployeeId
    asOf?: string
  }): Promise<EmployeeLifecycleState | CompanyOperationError> {
    let asOf: CalendarDate
    if (props.asOf === undefined) {
      const resolved = resolveCompanyBusinessDate({
        now: this.c.env.NOW ?? new Date().toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
      if (typeof resolved !== "string") {
        return new CompanyUnavailableError(
          "会社営業日を解決できません",
          "company_timezone_unavailable",
          {
            cause: resolved,
          },
        )
      }
      asOf = resolved
    } else if (!isCalendarDate(props.asOf)) {
      return new CompanyValidationError("as_of が不正です", "personnel_action_invalid_transition")
    } else {
      asOf = props.asOf
    }

    const workforce = await new ReadWorkforceState({
      workforce: new EmployeeLifecycleWorkforceAdapter(this.c),
      organization: new OrganizationUnitReadAdapter(this.c.var.database),
    }).execute({ employeeId: props.employeeId, asOf })

    if (workforce.kind === "not_found") {
      return new CompanyNotFoundError("従業員が見つかりません", "employee_not_found")
    }
    if (workforce.kind === "unavailable") {
      return new CompanyUnexpectedError("基準日現在の人事状態を取得できません", {
        cause: workforce.cause,
      })
    }
    if (workforce.kind === "invalid_schedule") {
      return new CompanyUnavailableError(
        "人事ライフサイクルの保存状態が不正です",
        "lifecycle_projection_mismatch",
        { cause: workforce.error },
      )
    }
    if (workforce.kind === "invalid_organization") {
      return new CompanyUnavailableError(
        "会社組織の保存状態が不正です",
        "lifecycle_projection_mismatch",
        {
          cause: workforce.error,
        },
      )
    }

    const states = await new EmployeeLifecycleReadAdapter(this.c).findStatesAt(
      [props.employeeId],
      asOf,
    )
    if (states instanceof CompanyOperationError) return states
    const projection = states.get(props.employeeId)
    if (projection === undefined) {
      return new CompanyUnavailableError(
        "人事ライフサイクルの表示状態を解決できません",
        "lifecycle_projection_mismatch",
      )
    }

    const state = toEmployeeLifecycleState({ workforce: workforce.state, projection })

    return state instanceof Error
      ? new CompanyUnavailableError(
          "人事ライフサイクルの表示状態が共通状態と一致しません",
          "lifecycle_projection_mismatch",
          { cause: state },
        )
      : state
  }
}
