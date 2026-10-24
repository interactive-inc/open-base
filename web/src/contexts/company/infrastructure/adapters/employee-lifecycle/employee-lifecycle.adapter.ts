import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import type {
  EmployeeStatusPeriod,
  EmploymentPeriod,
  LifecycleSchedule,
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type {
  LifecycleDepartmentReference,
  LifecycleEmployeeReference,
} from "@/contexts/company/domain/policies/project-personnel-action.policy"
import { CompanyOperationError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import type {
  EmployeeId,
  EmploymentId,
  PersonnelActionId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

type EmploymentRow = {
  period_id: string
  revision: number
  employee_id: EmployeeId
  starts_on: string
  ends_on: string | null
  is_void: number
  recorded_by_action_id: PersonnelActionId
  recorded_at: number
}

type StatusRow = EmploymentRow & {
  employment_period_id: string
  status: "active" | "leave"
}

type AssignmentRow = EmploymentRow & {
  employment_id: EmploymentId
  organization_unit_id: string
  organization_unit_code: string
  assignment_type: "PRIMARY" | "CONCURRENT"
  position_title: string | null
  manager_employee_id: EmployeeId | null
}

type ResponsibilityRow = Omit<EmploymentRow, "employee_id"> & {
  employment_id: EmploymentId
  organization_unit_id: string
  organization_unit_code: string
  responsibility_type: string
  employee_id: EmployeeId
}

function toEmployment(row: EmploymentRow): EmploymentPeriod {
  return {
    periodId: row.period_id,
    revision: row.revision,
    employeeId: row.employee_id,
    employmentId: restoreWorkforceId("employment", row.period_id),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isVoid: row.is_void === 1,
    recordedByActionId: row.recorded_by_action_id,
    recordedAt: row.recorded_at,
  }
}

function toStatus(row: StatusRow): EmployeeStatusPeriod {
  return {
    ...toEmployment(row),
    employmentPeriodId: restoreWorkforceId("employment", row.employment_period_id),
    status: row.status,
  }
}

function toAssignment(row: AssignmentRow): OrgAssignmentPeriod {
  return {
    ...toEmployment(row),
    employmentPeriodId: row.employment_id,
    organizationUnitId: restoreWorkforceId("organization_unit", row.organization_unit_id),
    departmentCode: row.organization_unit_code,
    assignmentType: row.assignment_type === "PRIMARY" ? "primary" : "concurrent",
    positionTitle: row.position_title,
    managerEmployeeId: row.manager_employee_id,
  }
}

function toResponsibility(row: ResponsibilityRow): OrgResponsibilityPeriod {
  return {
    periodId: row.period_id,
    revision: row.revision,
    employmentId: row.employment_id,
    organizationUnitId: restoreWorkforceId("organization_unit", row.organization_unit_id),
    departmentCode: row.organization_unit_code,
    responsibilityType:
      row.responsibility_type === "MANAGER"
        ? "department_manager"
        : restoreOrgResponsibilityType(row.responsibility_type),
    employeeId: row.employee_id,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isVoid: row.is_void === 1,
    recordedByActionId: row.recorded_by_action_id,
    recordedAt: row.recorded_at,
  }
}

function repositoryError(cause: unknown): CompanyOperationError {
  return new CompanyUnexpectedError("人事ライフサイクルの読み取りに失敗しました", { cause })
}

const employmentSelect = `
  SELECT period_id, revision, employee_id, starts_on, ends_on, is_void,
         recorded_by_action_id, recorded_at
  FROM company_employment_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM company_employment_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

const statusSelect = `
  SELECT period_id, revision, employment_period_id, employee_id, status, starts_on,
         ends_on, is_void, recorded_by_action_id, recorded_at
  FROM company_employee_status_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM company_employee_status_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

const assignmentSelect = `
  SELECT period_id, revision, employment_id, employee_id, organization_unit_id,
         (
           SELECT unit.code
           FROM company_organization_unit_period_versions AS unit
           WHERE unit.organization_unit_id = current.organization_unit_id
             AND unit.is_void = 0
             AND unit.starts_on <= current.starts_on
             AND (unit.ends_on IS NULL OR current.starts_on < unit.ends_on)
             AND unit.revision = (
               SELECT MAX(candidate.revision)
               FROM company_organization_unit_period_versions AS candidate
               WHERE candidate.period_id = unit.period_id
             )
           ORDER BY unit.starts_on DESC, unit.period_id DESC
           LIMIT 1
         ) AS organization_unit_code,
         assignment_type, position_title, manager_employee_id, starts_on, ends_on,
         is_void, recorded_by_action_id, recorded_at
  FROM company_organization_assignment_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM company_organization_assignment_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`

const responsibilitySelect = `
  SELECT period_id, revision, employment_id, employee_id, organization_unit_id,
         (
           SELECT unit.code
           FROM company_organization_unit_period_versions AS unit
           WHERE unit.organization_unit_id = current.organization_unit_id
             AND unit.is_void = 0
             AND unit.starts_on <= current.starts_on
             AND (unit.ends_on IS NULL OR current.starts_on < unit.ends_on)
             AND unit.revision = (
               SELECT MAX(candidate.revision)
               FROM company_organization_unit_period_versions AS candidate
               WHERE candidate.period_id = unit.period_id
             )
           ORDER BY unit.starts_on DESC, unit.period_id DESC
           LIMIT 1
         ) AS organization_unit_code,
         responsibility_type,
         starts_on, ends_on, is_void, recorded_by_action_id, recorded_at
  FROM company_organization_responsibility_period_versions AS current
  WHERE current.revision = (
    SELECT MAX(candidate.revision)
    FROM company_organization_responsibility_period_versions AS candidate
    WHERE candidate.period_id = current.period_id
  ) AND current.is_void = 0`
type Context = CompanyContext

export class EmployeeLifecycleAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async loadSchedule(employeeId: EmployeeId): Promise<LifecycleSchedule | CompanyOperationError> {
    try {
      const db = this.c.env.DB
      const [employments, statuses, assignments, responsibilities] = await Promise.all([
        db
          .prepare(`${employmentSelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`)
          .bind(employeeId)
          .all<EmploymentRow>(),
        db
          .prepare(`${statusSelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`)
          .bind(employeeId)
          .all<StatusRow>(),
        db
          .prepare(`${assignmentSelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`)
          .bind(employeeId)
          .all<AssignmentRow>(),
        db
          .prepare(
            `${responsibilitySelect} AND current.employee_id = ?1 ORDER BY starts_on, period_id`,
          )
          .bind(employeeId)
          .all<ResponsibilityRow>(),
      ])

      return {
        employments: employments.results.map(toEmployment),
        statuses: statuses.results.map(toStatus),
        assignments: assignments.results.map(toAssignment),
        responsibilities: responsibilities.results.map(toResponsibility),
      }
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadOrganizationSchedules(): Promise<
    ReadonlyArray<LifecycleSchedule> | CompanyOperationError
  > {
    try {
      const db = this.c.env.DB
      const [employments, statuses, assignments, responsibilities] = await Promise.all([
        db
          .prepare(`${employmentSelect} ORDER BY employee_id, starts_on, period_id`)
          .all<EmploymentRow>(),
        db.prepare(`${statusSelect} ORDER BY employee_id, starts_on, period_id`).all<StatusRow>(),
        db
          .prepare(`${assignmentSelect} ORDER BY employee_id, starts_on, period_id`)
          .all<AssignmentRow>(),
        db
          .prepare(`${responsibilitySelect} ORDER BY employee_id, starts_on, period_id`)
          .all<ResponsibilityRow>(),
      ])
      const employeeIds = new Set<EmployeeId>([
        ...employments.results.map((row) => row.employee_id),
        ...statuses.results.map((row) => row.employee_id),
        ...assignments.results.map((row) => row.employee_id),
        ...responsibilities.results.map((row) => row.employee_id),
      ])

      return [...employeeIds]
        .sort((left, right) => left.localeCompare(right))
        .map((employeeId) => ({
          employments: employments.results
            .filter((row) => row.employee_id === employeeId)
            .map(toEmployment),
          statuses: statuses.results.filter((row) => row.employee_id === employeeId).map(toStatus),
          assignments: assignments.results
            .filter((row) => row.employee_id === employeeId)
            .map(toAssignment),
          responsibilities: responsibilities.results
            .filter((row) => row.employee_id === employeeId)
            .map(toResponsibility),
        }))
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadRevisions(
    employeeId: EmployeeId,
  ): Promise<{ employeeRevision: number; organizationRevision: number } | CompanyOperationError> {
    try {
      const [employeeRevision, organizationRevision] = await Promise.all([
        this.c.env.DB.prepare(
          "SELECT revision FROM company_employee_lifecycle_revisions WHERE employee_id = ?1",
        )
          .bind(employeeId)
          .first<number>("revision"),
        this.c.env.DB.prepare(
          "SELECT revision FROM company_organization_lifecycle_states WHERE id = 1",
        ).first<number>("revision"),
      ])

      return {
        employeeRevision: employeeRevision ?? 0,
        organizationRevision: organizationRevision ?? 0,
      }
    } catch (cause) {
      return repositoryError(cause)
    }
  }

  async loadReferences(asOf: CalendarDate): Promise<
    | {
        departments: ReadonlyArray<LifecycleDepartmentReference>
        employees: ReadonlyArray<LifecycleEmployeeReference>
      }
    | CompanyOperationError
  > {
    try {
      const [departments, employees] = await Promise.all([
        OrganizationUnitReadAdapter.fromContext(this.c).readSnapshot(asOf),
        this.c.env.DB.prepare(
          `SELECT id, employee_code AS code
           FROM company_employees
           WHERE employee_code IS NOT NULL
           ORDER BY id`,
        ).all<{
          id: EmployeeId
          code: string
        }>(),
      ])

      if (!departments.ok) return repositoryError(departments.cause)
      if (!employees.success) return repositoryError(new Error("employee references unavailable"))
      return {
        departments: departments.snapshot.units,
        employees: employees.results,
      }
    } catch (cause) {
      return repositoryError(cause)
    }
  }
}
