import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { ReadWorkforceState } from "@/contexts/company/lib/workforce/read-workforce-state"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { periodContainsDate } from "@/contexts/company/domain/definitions/period-contains-date.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { EmployeeLifecycleReadAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle-read.adapter"
import type {
  EmployeeLifecycleState,
  LifecycleAssignmentState,
} from "@/contexts/company/lib/workforce/employee-lifecycle-state"
import { CompanyReportingRelationsReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-reporting-relations-read.adapter"
import { ReadCompanySnapshotEmployeesAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-company-snapshot-employees.adapter"
import { resolveWorkforceManagementRelations } from "@/contexts/company/domain/policies/resolve-workforce-management-relations.policy"
import { EmployeeLifecycleWorkforceAdapter } from "@/contexts/company/infrastructure/adapters/workforce/employee-lifecycle-workforce.adapter"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { toEmployeeLifecycleState } from "@/contexts/company/lib/workforce/to-employee-lifecycle-state"
import {
  CompanyOperationError,
  CompanyConflictError,
  CompanyNotFoundError,
  CompanyUnexpectedError,
  CompanyUnavailableError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

type LifecycleAssignmentWithManagers = LifecycleAssignmentState & {
  managerEmployeeIds: ReadonlyArray<EmployeeId>
  managerEmployeeCodes: ReadonlyArray<string>
}

type LifecycleStateWithManagers = Omit<
  EmployeeLifecycleState,
  "primaryAssignment" | "concurrentAssignments"
> & {
  primaryAssignment: LifecycleAssignmentWithManagers | null
  concurrentAssignments: ReadonlyArray<LifecycleAssignmentWithManagers>
}

export class GetLifecycleState {
  constructor(private readonly c: CompanyContext) {
    Object.freeze(this)
  }

  async run(props: {
    employeeId: EmployeeId
    asOf?: string
  }): Promise<LifecycleStateWithManagers | CompanyOperationError> {
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

    const reporting = await new CompanyReportingRelationsReadAdapter(this.c.env.DB).readSnapshot(
      asOf,
    )
    if (!reporting.ok) {
      return new CompanyUnavailableError(
        "上長関係を読み直してください。",
        "organization_snapshot_unavailable",
        { cause: reporting.cause },
      )
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

    if (state instanceof Error) {
      return new CompanyUnavailableError(
        "人事ライフサイクルの表示状態が共通状態と一致しません",
        "lifecycle_projection_mismatch",
        { cause: state },
      )
    }

    const organization = await new OrganizationUnitReadAdapter(this.c.var.database).readSnapshot(
      asOf,
    )
    if (!organization.ok) {
      return new CompanyUnavailableError(
        "組織情報を読み直してください。",
        "organization_snapshot_unavailable",
        { cause: organization.cause },
      )
    }
    if (organization.snapshot.revision !== workforce.organizationRevision) {
      return new CompanyConflictError(
        "組織情報が変わりました。読み直してください。",
        "organization_revision_conflict",
      )
    }
    const unitById = new Map(
      organization.snapshot.units
        .filter((unit) => !unit.isVoid && periodContainsDate(unit, asOf))
        .map((unit) => [unit.organizationUnitId, unit]),
    )

    const relations = resolveWorkforceManagementRelations({
      states: [workforce.state],
      reportingRelations: reporting.relations.filter(
        (relation) => relation.employeeId === props.employeeId,
      ),
    })
    if (relations instanceof Error) {
      return new CompanyUnavailableError(
        "上長関係を確認してください。",
        "lifecycle_projection_mismatch",
        { cause: relations },
      )
    }
    const managers = await new ReadCompanySnapshotEmployeesAdapter(this.c).read({
      employeeIds: [...new Set(relations.map((relation) => relation.managerEmployeeId))],
      asOf,
      organizationRevision: workforce.organizationRevision,
      companyRevision: reporting.companyRevision,
    })
    if (managers instanceof CompanyOperationError) return managers
    if (managers instanceof Error) {
      return new CompanyUnexpectedError("上長情報を読み直してください。", { cause: managers })
    }
    const codeById = new Map(managers.map((manager) => [manager.id, manager.employeeCode]))
    const withManagers = (
      assignment: LifecycleAssignmentState,
    ): LifecycleAssignmentWithManagers | CompanyUnavailableError => {
      const unit = unitById.get(assignment.organizationUnitId)
      if (unit === undefined) {
        return new CompanyUnavailableError(
          "所属先の組織情報を読み直してください。",
          "lifecycle_projection_mismatch",
        )
      }
      const managerEmployeeIds = [
        ...new Set(
          relations
            .filter((relation) => relation.organizationUnitId === assignment.organizationUnitId)
            .map((relation) => relation.managerEmployeeId),
        ),
      ].toSorted()
      const managerEmployeeCodes = managerEmployeeIds
        .flatMap((id) => {
          const code = codeById.get(id)
          return code === undefined || code === null ? [] : [code]
        })
        .toSorted()
      return {
        ...assignment,
        departmentCode: unit.code,
        departmentName: unit.officialName,
        managerEmployeeId: managerEmployeeIds.length === 1 ? (managerEmployeeIds[0] ?? null) : null,
        managerEmployeeCode:
          managerEmployeeIds.length === 1 ? (managerEmployeeCodes[0] ?? null) : null,
        managerEmployeeIds,
        managerEmployeeCodes,
      }
    }
    const primaryAssignment =
      state.primaryAssignment === null ? null : withManagers(state.primaryAssignment)
    if (primaryAssignment instanceof CompanyUnavailableError) return primaryAssignment
    const concurrentAssignments: LifecycleAssignmentWithManagers[] = []
    for (const assignment of state.concurrentAssignments) {
      const resolved = withManagers(assignment)
      if (resolved instanceof CompanyUnavailableError) return resolved
      concurrentAssignments.push(resolved)
    }
    return {
      ...state,
      primaryAssignment,
      concurrentAssignments,
    }
  }
}
