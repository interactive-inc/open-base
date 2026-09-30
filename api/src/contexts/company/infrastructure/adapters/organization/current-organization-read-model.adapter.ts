import { ReadCompanySnapshotEmployeesAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-company-snapshot-employees.adapter"
import { CompanyReportingRelationsReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-reporting-relations-read.adapter"
import { periodContainsDate } from "@/contexts/company/domain/definitions/period-contains-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { WorkforceStateAt } from "@/contexts/company/domain/policies/resolve-workforce-state.policy"
import type {
  EmployeeId,
  OrganizationUnitId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import { ReadOrganizationWorkforceState } from "@/contexts/company/lib/workforce/read-organization-workforce-state"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyUnavailableError } from "@/contexts/company/domain/errors"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"

export type CurrentOrganizationAssignment = {
  departmentCode: string
  position: string | null
  managerEmployeeCode: string | null
  managerEmployeeCodes: ReadonlyArray<string>
  managerEmployeeIds: ReadonlyArray<EmployeeId>
  assignmentType: "primary" | "concurrent"
}

export type CurrentOrganizationEmployee = {
  id: EmployeeId
  code: string
  name: string
  status: "active" | "leave"
  position: string | null
  primaryDepartmentCode: string | null
  managerEmployeeCode: string | null
  managerEmployeeCodes: ReadonlyArray<string>
  managerEmployeeIds: ReadonlyArray<EmployeeId>
  departmentCodes: ReadonlyArray<string>
  assignments: ReadonlyArray<CurrentOrganizationAssignment>
}

export type CurrentOrganizationDepartment = {
  id: OrganizationUnitId
  code: string
  name: string
  parentCode: string | null
  order: number
}

export type CurrentOrganizationReadModel = {
  source: "lifecycle"
  asOf: string
  organizationRevision: number
  departments: ReadonlyArray<CurrentOrganizationDepartment>
  employeesByCode: ReadonlyMap<string, CurrentOrganizationEmployee>
  managerByDepartmentCode: ReadonlyMap<string, string>
}

type EmployeeDirectoryRow = Readonly<{
  id: EmployeeId
  employeeCode: string | null
  officialName: string
}>

function activeStatus(state: WorkforceStateAt): "active" | "leave" | null {
  if (state.status === "ACTIVE") return "active"
  if (state.status === "ON_LEAVE") return "leave"
  return null
}

/** 現在有効なCompany Organization投影を読み込む。 */
async function loadCurrentOrganization(c: Context): Promise<CurrentOrganizationReadModel | Error> {
  try {
    const businessDate = resolveCompanyBusinessDate({
      now: c.env.NOW ?? new Date().toISOString(),
      timeZone: c.env.COMPANY_TIME_ZONE,
    })
    if (typeof businessDate !== "string") return businessDate
    const snapshot = await new ReadOrganizationWorkforceState({
      organization: new OrganizationUnitReadAdapter(c.var.database),
      workforce: new OrganizationWorkforceSnapshotAdapter(c),
      reporting: new CompanyReportingRelationsReadAdapter(c.env.DB),
    }).execute(restoreCalendarDate(businessDate))
    if (snapshot.kind !== "found") {
      return new CompanyUnavailableError(
        "Company organization snapshotを安全に解決できません",
        snapshot.kind === "invalid"
          ? "company_organization_invalid"
          : "company_organization_unavailable",
        snapshot.kind === "unavailable" ? { cause: snapshot.cause } : undefined,
      )
    }
    const employeeRows = await new ReadCompanySnapshotEmployeesAdapter(c).read({
      employeeIds: snapshot.employees
        .filter((employee) => activeStatus(employee) !== null)
        .map((employee) => employee.employeeId),
      asOf: snapshot.organization.asOf,
      organizationRevision: snapshot.organization.revision,
      companyRevision: snapshot.companyRevision,
    })
    if (employeeRows instanceof Error) return employeeRows

    const employeeById = new Map<EmployeeId, EmployeeDirectoryRow>(
      employeeRows.map((employee) => [employee.id, employee]),
    )
    const currentUnits = snapshot.organization.units.filter(
      (unit) => !unit.isVoid && periodContainsDate(unit, restoreCalendarDate(businessDate)),
    )
    const unitById = new Map(currentUnits.map((unit) => [unit.organizationUnitId, unit]))
    const organizationUnits = currentUnits.filter((unit) => unit.kind !== "COMPANY")
    const organizationCodes = new Set(organizationUnits.map((unit) => unit.code))
    const codeByUnitId = new Map<OrganizationUnitId, string>()
    for (const unit of organizationUnits) {
      codeByUnitId.set(unit.organizationUnitId, unit.code)
    }

    const currentDepartments = organizationUnits.map((unit, order) => {
      const parent =
        unit.parentOrganizationUnitId === null
          ? undefined
          : unitById.get(unit.parentOrganizationUnitId)

      return {
        id: unit.organizationUnitId,
        code: unit.code,
        name: unit.officialName,
        parentCode:
          parent === undefined || !organizationCodes.has(parent.code) ? null : parent.code,
        order,
      }
    })

    const employeesByCode = new Map<string, CurrentOrganizationEmployee>()
    const managersByDepartment = new Map<string, string[]>()
    const managerIdsByScope = new Map<string, Set<EmployeeId>>()
    for (const relation of snapshot.managementRelations) {
      const scope = JSON.stringify([relation.employeeId, relation.organizationUnitId])
      const ids = managerIdsByScope.get(scope)
      if (ids === undefined) managerIdsByScope.set(scope, new Set([relation.managerEmployeeId]))
      else ids.add(relation.managerEmployeeId)
    }
    for (const state of snapshot.employees) {
      const employee = employeeById.get(state.employeeId)
      const status = activeStatus(state)
      if (employee === undefined || employee.employeeCode === null || status === null) {
        continue
      }
      const assignments = [
        ...(state.primaryAssignment === null ? [] : [state.primaryAssignment]),
        ...state.concurrentAssignments,
      ].flatMap((assignment) => {
        const departmentCode = codeByUnitId.get(assignment.organizationUnitId)
        if (departmentCode === undefined) return []
        const managerEmployeeIds = [
          ...(managerIdsByScope.get(
            JSON.stringify([state.employeeId, assignment.organizationUnitId]),
          ) ?? []),
        ].toSorted()
        const managerEmployeeCodes = managerEmployeeIds
          .flatMap((id) => {
            const code = employeeById.get(id)?.employeeCode
            return code === undefined || code === null ? [] : [code]
          })
          .toSorted()

        return [
          {
            departmentCode,
            position: assignment.positionTitle,
            managerEmployeeCode:
              managerEmployeeIds.length === 1 ? (managerEmployeeCodes[0] ?? null) : null,
            managerEmployeeCodes,
            managerEmployeeIds,
            assignmentType:
              assignment.assignmentType === "PRIMARY"
                ? ("primary" as const)
                : ("concurrent" as const),
          },
        ]
      })
      const managerDepartmentCodes = state.responsibilities.flatMap((responsibility) => {
        if (responsibility.responsibilityType !== "MANAGER") return []
        const departmentCode = codeByUnitId.get(responsibility.organizationUnitId)

        return departmentCode === undefined ? [] : [departmentCode]
      })
      if (assignments.length === 0 && managerDepartmentCodes.length === 0) continue
      const primary = assignments.find((assignment) => assignment.assignmentType === "primary")
      employeesByCode.set(employee.employeeCode, {
        id: employee.id,
        code: employee.employeeCode,
        name: employee.officialName,
        status,
        position: primary?.position ?? null,
        primaryDepartmentCode: primary?.departmentCode ?? null,
        managerEmployeeCode: primary?.managerEmployeeCode ?? null,
        managerEmployeeCodes: primary?.managerEmployeeCodes ?? [],
        managerEmployeeIds: primary?.managerEmployeeIds ?? [],
        departmentCodes: [...new Set(assignments.map((assignment) => assignment.departmentCode))],
        assignments,
      })

      for (const departmentCode of managerDepartmentCodes) {
        managersByDepartment.set(departmentCode, [
          ...(managersByDepartment.get(departmentCode) ?? []),
          employee.employeeCode,
        ])
      }
    }

    return {
      source: "lifecycle",
      asOf: businessDate,
      organizationRevision: snapshot.organization.revision,
      departments: currentDepartments,
      employeesByCode,
      managerByDepartmentCode: new Map(
        [...managersByDepartment].flatMap(([code, managers]) =>
          managers.length === 1 ? [[code, managers[0]!] as const] : [],
        ),
      ),
    }
  } catch (error) {
    return error instanceof Error ? error : new Error("failed to load current organization")
  }
}
type Context = CompanyContext

export class CurrentOrganizationReadModelAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async loadCurrentOrganization(): Promise<CurrentOrganizationReadModel | Error> {
    return loadCurrentOrganization(this.c)
  }
}
