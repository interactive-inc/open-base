import { companyEmployeeProfileSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employee-profile-sql"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"
import type {
  WorkforceSnapshotReadPort,
  WorkforceSnapshotReadResult,
} from "@/contexts/company/domain/definitions/organization-change.definition"
import { toWorkforceLifecycleSchedules } from "@/contexts/company/domain/policies/to-workforce-lifecycle-schedules.policy"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { WorkforceLifecycleSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { EmployeeLifecycleAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle.adapter"
import {
  attachOrganizationPeriods,
  type OrgAssignmentProjectionRow,
  type OrgResponsibilityProjectionRow,
} from "@/contexts/company/lib/workforce/organization-period-row.adapter"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { ReadWorkforceBaselineStatesAdapter } from "@/contexts/company/infrastructure/adapters/workforce/read-workforce-baseline-states.adapter"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemAccountRepository } from "@system/infrastructure/repositories/auth/system-account.repository"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

type EmployeeRow = Readonly<{
  id: EmployeeId
  employeeCode: string | null
  officialName: string | null
  email: string | null
  phone: string | null
}>

type AssignmentRow = Omit<OrgAssignmentProjectionRow, "isVoid"> & Readonly<{ isVoid: number }>
type ResponsibilityRow = Omit<OrgResponsibilityProjectionRow, "isVoid"> &
  Readonly<{ isVoid: number }>

function emptySchedule(employeeId: EmployeeId): WorkforceLifecycleSchedule {
  return { employeeId, employments: [], statuses: [], assignments: [], responsibilities: [] }
}
type Context = CompanyContext

/** 既存Employee・lifecycle保存を共通の全社Workforce snapshotへ接続する。 */
export class OrganizationWorkforceSnapshotAdapter implements WorkforceSnapshotReadPort {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  /** 従業員の氏名、従業員 code、連絡先を、従業員ごとの正本から読む。規則は companyEmployeeProfileSql に従う。 */
  private async readEmployees(asOf?: CalendarDate): Promise<D1Result<EmployeeRow>> {
    const effectiveOn =
      asOf ??
      resolveCompanyBusinessDate({
        now: this.c.env.NOW ?? new Date().toISOString(),
        timeZone: this.c.env.COMPANY_TIME_ZONE,
      })
    if (effectiveOn instanceof Error) throw effectiveOn
    return this.c.env.DB.prepare(
      `${companyEmployeeProfileSql()}
       SELECT id, employee_code AS employeeCode, official_name AS officialName, email, phone
       FROM employee_profiles
       ORDER BY id`,
    )
      .bind(effectiveOn)
      .all<EmployeeRow>()
  }

  async readAllSnapshot(asOf?: CalendarDate): Promise<WorkforceSnapshotReadResult> {
    try {
      const [sourceSchedules, employees, links, assignments, responsibilities, baselineStates] =
        await Promise.all([
          new EmployeeLifecycleAdapter(this.c).loadOrganizationSchedules(),
          this.readEmployees(asOf),
          new CompanyAccountEmployeeLinksReadAdapter(this.c).findMany({ asOf }),
          this.c.env.DB.prepare(
            `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  assignment_type AS assignmentType, position_title AS positionTitle,
                  manager_employee_id AS managerEmployeeId, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM company_organization_assignment_period_versions
             ORDER BY period_id, revision`,
          ).all<AssignmentRow>(),
          this.c.env.DB.prepare(
            `SELECT period_id AS periodId, revision, employment_id AS employmentId,
                  employee_id AS employeeId, organization_unit_id AS organizationUnitId,
                  responsibility_type AS responsibilityType, starts_on AS startsOn,
                  ends_on AS endsOn, is_void AS isVoid,
                  recorded_by_action_id AS recordedByActionId, recorded_at AS recordedAt
             FROM company_organization_responsibility_period_versions
             ORDER BY period_id, revision`,
          ).all<ResponsibilityRow>(),
          new ReadWorkforceBaselineStatesAdapter(this.c.env.DB).readWorkforceBaselineStates(),
        ])
      if (sourceSchedules instanceof CompanyOperationError) {
        return { ok: false, cause: sourceSchedules }
      }

      if (links instanceof Error) return { ok: false, cause: links }

      const canonicalSchedules = attachOrganizationPeriods({
        schedules: toWorkforceLifecycleSchedules(sourceSchedules),
        assignmentRows: assignments.results.map((row) => ({ ...row, isVoid: row.isVoid === 1 })),
        responsibilityRows: responsibilities.results.map((row) => ({
          ...row,
          isVoid: row.isVoid === 1,
        })),
      })
      const schedules = new Map(
        canonicalSchedules.map((schedule) => [schedule.employeeId, schedule]),
      )
      const accountRows = await new SystemAccountRepository({ database: this.c.env.DB }).findMany(
        links.flatMap((link) => {
          const accountId = zAccountId.safeParse(link.accountId)
          return accountId.success ? [accountId.data] : []
        }),
      )
      if (accountRows instanceof Error) return { ok: false, cause: accountRows }
      const activeAccountIds = new Set(
        accountRows
          .filter((account) => account.status === "active")
          .map((account) => String(account.id)),
      )
      const linksByEmployee = new Map(
        links.flatMap((link) =>
          activeAccountIds.has(link.accountId) ? [[link.employeeId, link] as const] : [],
        ),
      )

      return {
        ok: true,
        schedules: employees.results.map((employee) => {
          const employeeId = employee.id
          const schedule = schedules.get(employeeId) ?? emptySchedule(employeeId)
          const link = linksByEmployee.get(employee.id)

          return {
            employee: {
              id: employeeId,
              // 接続済みで有効な公開 resource の無い従業員は空の氏名で返し、正規の形式の検証で拒否させる。
              officialName: employee.officialName ?? "",
              employeeCode: employee.employeeCode,
              email: employee.email,
              phone: employee.phone,
            },
            baselineState: baselineStates.get(employeeId),
            employments: schedule.employments,
            statuses: schedule.statuses,
            assignments: schedule.assignments,
            responsibilities: schedule.responsibilities,
            accountLink:
              link === undefined
                ? null
                : {
                    accountId: restoreWorkforceId("system_account", link.accountId),
                    employeeId,
                  },
          }
        }),
      }
    } catch (cause) {
      return { ok: false, cause }
    }
  }
}
