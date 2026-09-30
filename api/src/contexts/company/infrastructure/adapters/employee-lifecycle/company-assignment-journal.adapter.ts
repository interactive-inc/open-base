import type { PersonnelActionPersistenceProps } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/personnel-action-persistence-props"
import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { CompanyAssignmentJournalChangeValue } from "@/contexts/company/domain/values/company-assignment-journal-change.value"
import { CompanyAssignmentResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-assignment-resource-history.adapter"
import {
  CompanyConflictError,
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"

const rowSchema = z.object({
  resource_id: z.string(),
  resource_revision: z.number().int().positive(),
  source_employee_id: z.string(),
  period_revision: z.number().int().positive(),
  period_id: z.string(),
  revision: z.number().int().positive(),
  employee_id: z.string(),
  employment_id: z.string(),
  organization_unit_id: z.string(),
  assignment_type: z.enum(["PRIMARY", "CONCURRENT"]),
  position_title: z.string().nullable(),
  manager_employee_id: z.string().nullable(),
  starts_on: z.string().refine(isCalendarDate),
  ends_on: z.string().refine(isCalendarDate).nullable(),
  is_void: z.number().int().min(0).max(1),
  recorded_by_action_id: z.string(),
  recorded_at: z.number().int().nonnegative(),
})
type Context = D1Database
type PreparedAssignments = Readonly<{
  resources: ReadonlyArray<CompanyResourceEntity>
  bindings: ReadonlyArray<D1PreparedStatement>
  periodIds: ReadonlySet<string>
}>

/** 公開Employeeの新しい所属と接続済み所属の変更を、同じ履歴と期間対応へ記録する。 */
export class CompanyAssignmentJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    props: PersonnelActionPersistenceProps,
  ): Promise<PreparedAssignments | CompanyOperationError> {
    try {
      const mutations = props.projection.mutations
        .filter((mutation) => mutation.periodType === "assignment")
        .filter((mutation) => mutation.after.employeeId === props.action.employeeId)
      if (mutations.length === 0) return { resources: [], bindings: [], periodIds: new Set() }
      const selected = await this.c
        .prepare(`SELECT period.*, binding.resource_id, binding.period_revision,
        resource.resource_revision, resource.employee_id AS source_employee_id
        FROM company_assignment_period_bindings binding
        JOIN company_assignment_resource_bindings resource ON resource.resource_id = binding.resource_id
        JOIN company_organization_assignment_period_versions period ON period.period_id = binding.period_id
        WHERE resource.employee_id = ?1 AND period.revision = (
          SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)
        ORDER BY period.period_id`)
        .bind(props.action.employeeId)
        .all()
      if (!selected.success) return new CompanyUnexpectedError("公開所属の対応を参照できません")
      const rows = z.array(rowSchema).safeParse(selected.results)
      if (!rows.success)
        return new CompanyUnexpectedError("公開所属の対応が不正です", { cause: rows.error })
      if (
        rows.data.some(
          (row) =>
            row.revision !== row.period_revision || row.employee_id !== row.source_employee_id,
        )
      )
        return new CompanyConflictError(
          "所属の対応する版が更新されています",
          "personnel_action_stale",
        )
      const byPeriod = new Map(rows.data.map((row) => [row.period_id, row]))
      const affected = new Set(
        mutations.flatMap((mutation) => {
          const binding = byPeriod.get(mutation.after.periodId)
          return binding === undefined ? [] : [binding.resource_id]
        }),
      )
      if (affected.size === 0 && props.prospectiveEmployee === undefined) {
        const employee = await this.c
          .prepare(`SELECT organization_id FROM company_workforce_resource_bindings
          WHERE resource_type = 'employee' AND resource_id = ?1`)
          .bind(props.action.employeeId)
          .first<{ organization_id: string }>()
        if (employee === null) return { resources: [], bindings: [], periodIds: new Set() }
        if (employee.organization_id !== COMPANY_DEFAULT_ORGANIZATION_ID)
          return new CompanyValidationError(
            "従業員の会社が所属台帳と一致しません",
            "lifecycle_projection_mismatch",
          )
      }
      const periodsByResource = new Map<string, Map<string, OrgAssignmentPeriod>>()
      const periodIds = new Set(rows.data.map((row) => row.period_id))
      for (const resourceId of affected) {
        periodsByResource.set(
          resourceId,
          new Map(
            rows.data
              .filter((row) => row.resource_id === resourceId)
              .map((row) => [row.period_id, this.toPeriod(row)]),
          ),
        )
      }
      for (const mutation of mutations) {
        const binding = byPeriod.get(mutation.after.periodId)
        if (binding === undefined && mutation.before !== null) continue
        const period = mutation.after
        periodIds.add(period.periodId)
        const resourceId =
          binding?.resource_id ?? deterministicCompanyId("assignment", period.periodId)
        if (binding === undefined) {
          const unit = await this.c
            .prepare(`SELECT organization_id FROM company_organization_resource_bindings
            WHERE organization_unit_id = ?1`)
            .bind(period.organizationUnitId)
            .first<{ organization_id: string }>()
          if (unit?.organization_id !== COMPANY_DEFAULT_ORGANIZATION_ID)
            return new CompanyValidationError(
              "異動先の組織履歴が未接続です",
              "lifecycle_projection_mismatch",
            )
        }
        const group = periodsByResource.get(resourceId) ?? new Map<string, OrgAssignmentPeriod>()
        group.set(period.periodId, {
          periodId: restoreWorkforceId("period", period.periodId),
          revision: period.revision,
          employeeId: period.employeeId,
          employmentId: period.employmentPeriodId,
          organizationUnitId: period.organizationUnitId,
          assignmentType: period.assignmentType === "primary" ? "PRIMARY" : "CONCURRENT",
          positionTitle: period.positionTitle,
          managerEmployeeId: null,
          startsOn: restoreCalendarDate(period.startsOn),
          endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
          isVoid: period.isVoid,
          recordedByActionId: restoreWorkforceId("personnel_action", period.recordedByActionId),
          recordedAt: period.recordedAt * 1000,
        })
        periodsByResource.set(resourceId, group)
      }
      const resources: CompanyResourceEntity[] = []
      const bindings: D1PreparedStatement[] = []
      for (const [resourceId, periods] of periodsByResource) {
        const history = await new CompanyAssignmentResourceHistoryAdapter(this.c).read({
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          id: resourceId,
        })
        if (history instanceof Error)
          return new CompanyUnexpectedError("公開所属の履歴を参照できません", { cause: history })
        const previous = rows.data.find((row) => row.resource_id === resourceId)
        if ((previous?.resource_revision ?? 0) !== history.length)
          return new CompanyConflictError(
            "公開所属の版が更新されています",
            "personnel_action_stale",
          )
        const change = CompanyAssignmentJournalChangeValue.create({
          resourceId,
          history,
          periods: [...periods.values()],
        })
        if (change instanceof Error)
          return new CompanyValidationError(
            "発令後の所属履歴を作成できません",
            "lifecycle_projection_mismatch",
            { cause: change },
          )
        const revision = change.resources.at(-1)?.revision ?? history.length
        resources.push(...change.resources)
        bindings.push(
          this.c
            .prepare(`INSERT INTO company_assignment_resource_bindings
          (resource_id, organization_id, employee_id, resource_revision, recorded_at)
          VALUES (?1, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?2, ?3, ?4)
          ON CONFLICT (resource_id) DO UPDATE SET resource_revision = excluded.resource_revision, recorded_at = excluded.recorded_at`)
            .bind(resourceId, props.action.employeeId, revision, props.action.recordedAt * 1000),
        )
        for (const period of periods.values()) {
          const source = [...history, ...change.resources]
            .filter((resource) => resource.effectiveFrom <= period.startsOn)
            .toSorted(
              (left, right) =>
                right.effectiveFrom.localeCompare(left.effectiveFrom) ||
                right.revision - left.revision,
            )[0]
          if (source === undefined)
            return new CompanyUnexpectedError("所属期間の公開履歴がありません")
          bindings.push(
            this.c
              .prepare(`INSERT INTO company_assignment_period_bindings
            (period_id, resource_id, period_revision, source_revision) VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT (period_id) DO UPDATE SET period_revision = excluded.period_revision, source_revision = excluded.source_revision`)
              .bind(period.periodId, resourceId, period.revision, source.revision),
          )
        }
      }
      return { resources, bindings, periodIds }
    } catch (cause) {
      return new CompanyUnexpectedError("公開所属の履歴を準備できません", { cause })
    }
  }

  private toPeriod(row: z.infer<typeof rowSchema>): OrgAssignmentPeriod {
    return {
      periodId: restoreWorkforceId("period", row.period_id),
      revision: row.revision,
      employeeId: restoreWorkforceId("employee", row.employee_id),
      employmentId: restoreWorkforceId("employment", row.employment_id),
      organizationUnitId: restoreWorkforceId("organization_unit", row.organization_unit_id),
      assignmentType: row.assignment_type,
      positionTitle: row.position_title,
      managerEmployeeId:
        row.manager_employee_id === null
          ? null
          : restoreWorkforceId("employee", row.manager_employee_id),
      startsOn: restoreCalendarDate(row.starts_on),
      endsOn: row.ends_on === null ? null : restoreCalendarDate(row.ends_on),
      isVoid: row.is_void === 1,
      recordedByActionId: restoreWorkforceId("personnel_action", row.recorded_by_action_id),
      recordedAt: row.recorded_at,
    }
  }
}
