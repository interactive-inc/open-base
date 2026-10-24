import type {
  WorkforceLifecycleReadPort,
  WorkforceLifecycleReadPortResult,
} from "@/contexts/company/lib/workforce/read-workforce-state"
import { toWorkforceLifecycleSchedules } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import {
  attachOrganizationPeriods,
  type OrgAssignmentProjectionRow,
  type OrgResponsibilityProjectionRow,
} from "@/contexts/company/lib/workforce/organization-period-row.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { ReadWorkforceBaselineStatesAdapter } from "@/contexts/company/infrastructure/adapters/workforce/read-workforce-baseline-states.adapter"

type AssignmentRow = Omit<OrgAssignmentProjectionRow, "isVoid"> & Readonly<{ isVoid: number }>
type ResponsibilityRow = Omit<OrgResponsibilityProjectionRow, "isVoid"> &
  Readonly<{ isVoid: number }>

function emptySchedule(employeeId: EmployeeId): WorkforceLifecycleSchedule {
  return {
    employeeId,
    employments: [],
    statuses: [],
    assignments: [],
    responsibilities: [],
  }
}
type Context = CompanyContext

/** open-baseのD1 lifecycle tablesを共通Workforce Application portへ接続する。 */
export class EmployeeLifecycleWorkforceAdapter implements WorkforceLifecycleReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findByEmployeeId(employeeId: EmployeeId): Promise<WorkforceLifecycleReadPortResult> {
    try {
      const exists = await this.c.env.DB.prepare("SELECT id FROM company_employees WHERE id = ?1")
        .bind(employeeId)
        .first<string>("id")
      if (exists === null) return { ok: true, schedule: null }

      const source = await new EmployeeLifecycleAdapter(this.c).loadSchedule(employeeId)
      if (source instanceof CompanyOperationError) return { ok: false, cause: source }

      const [assignments, responsibilities, baselineStates] = await Promise.all([
        this.c.env.DB.prepare(
          `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  assignment_type AS assignmentType, position_title AS positionTitle,
                  manager_employee_id AS managerEmployeeId, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM company_organization_assignment_period_versions
             WHERE employee_id = ?1
             ORDER BY period_id, revision`,
        )
          .bind(employeeId)
          .all<AssignmentRow>(),
        this.c.env.DB.prepare(
          `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  responsibility_type AS responsibilityType, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM company_organization_responsibility_period_versions
             WHERE employee_id = ?1
             ORDER BY period_id, revision`,
        )
          .bind(employeeId)
          .all<ResponsibilityRow>(),
        new ReadWorkforceBaselineStatesAdapter(this.c.env.DB).readWorkforceBaselineStates(),
      ])
      const baseSchedule = toWorkforceLifecycleSchedules([source])[0] ?? emptySchedule(employeeId)
      const schedule = attachOrganizationPeriods({
        schedules: [
          {
            ...baseSchedule,
            baselineState: baselineStates.get(employeeId),
          },
        ],
        assignmentRows: assignments.results.map((row) => ({ ...row, isVoid: row.isVoid === 1 })),
        responsibilityRows: responsibilities.results.map((row) => ({
          ...row,
          isVoid: row.isVoid === 1,
        })),
      })[0]

      return {
        ok: true,
        schedule: schedule ?? emptySchedule(employeeId),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
