import { companyEmploymentStateSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employment-state-sql"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyOperationError, CompanyUnexpectedError } from "@/contexts/company/domain/errors"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type {
  EmploymentId,
  OrganizationUnitId,
  WorkforcePeriodId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { EmployeeLifecycleState } from "@/contexts/company/lib/workforce/employee-lifecycle-state"

type EmployeeRow = {
  id: EmployeeId
  code: string
  employee_revision: number
  organization_revision: number
}

type EmploymentRow = {
  period_id: string
  employee_id: EmployeeId
  starts_on: string
  ends_on: string | null
}

type StatusRow = EmploymentRow & {
  employment_period_id: string
  status: "active" | "leave"
}

type AssignmentRow = EmploymentRow & {
  employment_period_id: EmploymentId
  organization_unit_id: OrganizationUnitId
  department_code: string
  department_name: string
  assignment_type: "primary" | "concurrent"
  position_title: string | null
  manager_employee_id: EmployeeId | null
  manager_employee_code: string | null
}

type ResponsibilityRow = {
  period_id: WorkforcePeriodId
  employment_period_id: EmploymentId
  employee_id: EmployeeId
  organization_unit_id: OrganizationUnitId
  department_code: string
  starts_on: string
  ends_on: string | null
}

function contains(row: { starts_on: string; ends_on: string | null }, asOf: string): boolean {
  return row.starts_on <= asOf && (row.ends_on === null || asOf < row.ends_on)
}

function placeholders(ids: ReadonlyArray<EmployeeId>): string {
  return ids.map((_, index) => `?${index + 1}`).join(", ")
}
type Context = CompanyContext

export class EmployeeLifecycleReadAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findStatesAt(
    employeeIds: ReadonlyArray<EmployeeId>,
    asOf: string,
  ): Promise<ReadonlyMap<EmployeeId, EmployeeLifecycleState> | CompanyOperationError> {
    const ids = [...new Set(employeeIds)]
    if (ids.length === 0) return new Map()
    const idList = placeholders(ids)

    try {
      const [employeeRows, employmentRows, statusRows, assignmentRows, responsibilityRows] =
        await Promise.all([
          this.c.env.DB.prepare(
            `${companyEmploymentStateSql()} SELECT employee.id, employee.employee_code AS code,
                      COALESCE(revision.revision, 0) AS employee_revision,
                      COALESCE((SELECT revision FROM company_organization_lifecycle_states WHERE id = 1), 0)
                        AS organization_revision
               FROM current_employees AS employee
               LEFT JOIN company_employee_lifecycle_revisions AS revision
                 ON revision.employee_id = employee.id
               WHERE employee.id IN (SELECT value FROM json_each(?2))`,
          )
            .bind(asOf, JSON.stringify(ids))
            .all<EmployeeRow>(),
          this.c.env.DB.prepare(
            `SELECT current.period_id, current.employee_id, current.starts_on, current.ends_on
               FROM company_employment_period_versions AS current
               WHERE current.employee_id IN (${idList})
                 AND current.revision = (
                   SELECT MAX(candidate.revision)
                   FROM company_employment_period_versions AS candidate
                   WHERE candidate.period_id = current.period_id
                 )
                 AND current.is_void = 0`,
          )
            .bind(...ids)
            .all<EmploymentRow>(),
          this.c.env.DB.prepare(
            `SELECT current.period_id, current.employment_period_id, current.employee_id,
                      current.status, current.starts_on, current.ends_on
               FROM company_employee_status_period_versions AS current
               WHERE current.employee_id IN (${idList})
                 AND current.revision = (
                   SELECT MAX(candidate.revision)
                   FROM company_employee_status_period_versions AS candidate
                   WHERE candidate.period_id = current.period_id
                 )
                 AND current.is_void = 0`,
          )
            .bind(...ids)
            .all<StatusRow>(),
          this.c.env.DB.prepare(
            `SELECT current.period_id, current.employment_id AS employment_period_id,
                      current.employee_id, current.organization_unit_id,
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
                      ) AS department_code,
                      (
                        SELECT unit.official_name
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
                      ) AS department_name,
                      CASE current.assignment_type
                        WHEN 'PRIMARY' THEN 'primary'
                        ELSE 'concurrent'
                      END AS assignment_type,
                      current.position_title,
                      current.manager_employee_id, manager.employee_code AS manager_employee_code,
                      current.starts_on, current.ends_on
               FROM company_organization_assignment_period_versions AS current
               LEFT JOIN company_employees AS manager ON manager.id = current.manager_employee_id
               WHERE current.employee_id IN (${idList})
                 AND current.revision = (
                   SELECT MAX(candidate.revision)
                   FROM company_organization_assignment_period_versions AS candidate
                   WHERE candidate.period_id = current.period_id
                 )
                 AND current.is_void = 0`,
          )
            .bind(...ids)
            .all<AssignmentRow>(),
          this.c.env.DB.prepare(
            `SELECT current.period_id, current.employment_id AS employment_period_id,
                      current.employee_id, current.organization_unit_id,
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
                      ) AS department_code,
                      current.starts_on, current.ends_on
               FROM company_organization_responsibility_period_versions AS current
               WHERE current.employee_id IN (${idList})
                 AND current.responsibility_type = 'MANAGER'
                 AND current.revision = (
                   SELECT MAX(candidate.revision)
                   FROM company_organization_responsibility_period_versions AS candidate
                   WHERE candidate.period_id = current.period_id
                 )
                 AND current.is_void = 0`,
          )
            .bind(...ids)
            .all<ResponsibilityRow>(),
        ])
      const states = new Map<EmployeeId, EmployeeLifecycleState>()

      for (const employee of employeeRows.results) {
        const employments = employmentRows.results.filter((row) => row.employee_id === employee.id)
        const employment = employments.find((row) => contains(row, asOf))
        const status =
          employment === undefined
            ? employments.some((row) => row.starts_on < asOf)
              ? "retired"
              : employments.some((row) => row.starts_on > asOf)
                ? "prehire"
                : "retired"
            : (statusRows.results.find(
                (row) =>
                  row.employee_id === employee.id &&
                  row.employment_period_id === employment.period_id &&
                  contains(row, asOf),
              )?.status ?? "active")
        const assignments = assignmentRows.results
          .filter(
            (row) =>
              row.employee_id === employee.id &&
              row.employment_period_id === employment?.period_id &&
              contains(row, asOf),
          )
          .map((row) => ({
            periodId: restoreWorkforceId("period", row.period_id),
            employmentPeriodId: restoreWorkforceId("employment", row.employment_period_id),
            organizationUnitId: restoreWorkforceId("organization_unit", row.organization_unit_id),
            departmentCode: row.department_code,
            departmentName: row.department_name,
            assignmentType: row.assignment_type,
            positionTitle: row.position_title,
            managerEmployeeId: row.manager_employee_id,
            managerEmployeeCode: row.manager_employee_code,
            startsOn: row.starts_on,
            endsOn: row.ends_on,
          }))
          .sort(
            (left, right) =>
              left.departmentCode.localeCompare(right.departmentCode) ||
              left.periodId.localeCompare(right.periodId),
          )

        states.set(employee.id, {
          employeeId: employee.id,
          employeeCode: employee.code,
          asOf,
          status,
          employmentPeriodId:
            employment === undefined
              ? null
              : restoreWorkforceId("employment", employment.period_id),
          primaryAssignment:
            assignments.find((assignment) => assignment.assignmentType === "primary") ?? null,
          concurrentAssignments: assignments.filter(
            (assignment) => assignment.assignmentType === "concurrent",
          ),
          responsibilities: responsibilityRows.results
            .filter((row) => row.employee_id === employee.id && contains(row, asOf))
            .map((row) => ({
              periodId: restoreWorkforceId("period", row.period_id),
              employmentPeriodId: restoreWorkforceId("employment", row.employment_period_id),
              organizationUnitId: restoreWorkforceId("organization_unit", row.organization_unit_id),
              departmentCode: row.department_code,
              startsOn: row.starts_on,
              endsOn: row.ends_on,
            }))
            .sort((left, right) => left.periodId.localeCompare(right.periodId)),
          responsibilityDepartmentCodes: responsibilityRows.results
            .filter((row) => row.employee_id === employee.id && contains(row, asOf))
            .map((row) => row.department_code)
            .sort(),
          employeeRevision: employee.employee_revision,
          organizationRevision: employee.organization_revision,
        })
      }

      return states
    } catch (cause) {
      return new CompanyUnexpectedError("基準日現在の人事状態を取得できません", { cause })
    }
  }
}
