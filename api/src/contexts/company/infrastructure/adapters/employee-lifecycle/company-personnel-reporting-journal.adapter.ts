import type { PersonnelActionPersistenceProps } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/lib/personnel-action-persistence-props"
import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import type { OrganizationRelation } from "@/contexts/company/domain/definitions/organization-relation.definition"
import { CompanyPersonnelReportingChangeValue } from "@/contexts/company/domain/values/company-personnel-reporting-change.value"
import { CompanyReportingEmploymentChangeValue } from "@/contexts/company/domain/values/company-reporting-employment-change.value"
import { CompanyReportingRelationTimelineValue } from "@/contexts/company/domain/values/company-reporting-relation-timeline.value"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { periodsContainPeriod } from "@/contexts/company/domain/definitions/periods-contain-period.definition"
import {
  CompanyConflictError,
  CompanyOperationError,
  CompanyUnexpectedError,
  CompanyValidationError,
} from "@/contexts/company/domain/errors"
import { z } from "zod"
import type { PersonnelActionSummary } from "@/contexts/company/domain/definitions/personnel-action-summary.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const bindingSchema = z.object({
  resource_id: z.string(),
  employee_id: z.string(),
  employment_id: z.string(),
  organization_unit_id: z.string(),
  assignment_type: z.enum(["PRIMARY", "CONCURRENT"]),
})
type Binding = z.infer<typeof bindingSchema>
type Context = D1Database
type Prepared = Readonly<{
  resources: ReadonlyArray<CompanyResourceEntity>
  bindings: ReadonlyArray<D1PreparedStatement>
  summary: PersonnelActionSummary
}>

/** 人事発令の直属上長を独立した公開履歴へ記録し、別途登録した上長関係を保全する。 */
export class CompanyPersonnelReportingJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    props: PersonnelActionPersistenceProps,
    periodIds: ReadonlySet<string>,
    organizationRevision: number | null,
  ): Promise<Prepared | CompanyOperationError> {
    if (organizationRevision === null)
      return { resources: [], bindings: [], summary: props.action.summary }
    try {
      const history = await new D1CompanyResourceRepository({
        database: this.c,
      }).findReportingRelationHistory(COMPANY_DEFAULT_ORGANIZATION_ID, organizationRevision)
      if (history instanceof Error) throw history
      const selected = await this.c
        .prepare("SELECT * FROM company_personnel_reporting_bindings WHERE employee_id = ?1")
        .bind(props.action.employeeId)
        .all()
      if (!selected.success) throw new Error("Reporting bindings are unavailable")
      const existing = z.array(bindingSchema).parse(selected.results)
      const scopes = [...existing]
      const input =
        props.command.input.kind === "corrected"
          ? props.command.input.replacementAction
          : props.command.input
      const replacements = props.projection.mutations.flatMap((mutation) =>
        mutation.periodType === "assignment" &&
        mutation.after.employeeId === props.action.employeeId &&
        mutation.before === null &&
        !mutation.after.isVoid &&
        periodIds.has(mutation.after.periodId) &&
        ("managerEmployeeCode" in input || mutation.after.managerEmployeeId !== null)
          ? [mutation.after]
          : [],
      )
      for (const period of replacements) {
        if (scopes.some((scope) => this.matches(scope, period))) continue
        if (period.managerEmployeeId === null) continue
        scopes.push({
          resource_id: crypto.randomUUID(),
          employee_id: period.employeeId,
          employment_id: period.employmentPeriodId,
          organization_unit_id: period.organizationUnitId,
          assignment_type: period.assignmentType === "primary" ? "PRIMARY" : "CONCURRENT",
        })
      }
      const correction = await this.correctionRevisions(props.action.correctsActionId)
      if (correction instanceof Error) throw correction
      const resources: CompanyResourceEntity[] = []
      const bindings: D1PreparedStatement[] = []
      let summary = props.action.summary
      for (const scope of scopes) {
        const versions = history.filter((resource) => resource.id === scope.resource_id)
        if (existing.includes(scope) && versions.length === 0)
          throw new Error("Reporting binding has no public history")
        const original = correction.filter((row) => row.resource_id === scope.resource_id)
        if (
          original.length > 0 &&
          versions.some(
            (resource) => resource.revision > Math.max(...original.map((row) => row.revision)),
          )
        )
          return new CompanyConflictError(
            "訂正対象の上長関係は後続の変更を受けています",
            "personnel_action_stale",
          )
        const basis =
          original.length === 0
            ? versions
            : versions.filter(
                (resource) => resource.revision < Math.min(...original.map((row) => row.revision)),
              )
        const candidates = replacements.filter((period) => this.matches(scope, period))
        if (candidates.length > 1)
          return new CompanyValidationError(
            "同じ範囲の上長指定が重複しています",
            "lifecycle_projection_mismatch",
          )
        const replacement = candidates[0]
        if (summary.kind === "manager_changed" && replacement !== undefined) {
          const previous = versions
            .filter((resource) => resource.effectiveFrom <= replacement.startsOn)
            .toSorted(
              (left, right) =>
                right.effectiveFrom.localeCompare(left.effectiveFrom) ||
                right.revision - left.revision,
            )[0]
          const managerId =
            previous?.state === "active" &&
            previous.contains(restoreCalendarDate(replacement.startsOn))
              ? previous.readText("managerEmployeeId")
              : null
          summary = {
            ...summary,
            previousManagerEmployeeCode:
              [...props.employeeCodes].find(([id]) => id === managerId)?.[1] ?? null,
          }
        }
        const change = CompanyPersonnelReportingChangeValue.create({
          resourceId: scope.resource_id,
          employeeId: scope.employee_id,
          organizationUnitId: scope.organization_unit_id,
          history: versions,
          basis,
          coverage: props.projection.schedule.assignments
            .filter(
              (period) =>
                !period.isVoid && periodIds.has(period.periodId) && this.matches(scope, period),
            )
            .map((period) => this.period(period)),
          ...(replacement === undefined
            ? {}
            : {
                replacement: {
                  ...this.replacementPeriod(replacement, basis),
                  managerEmployeeId: replacement.managerEmployeeId,
                },
              }),
        })
        if (change instanceof Error)
          return new CompanyValidationError(
            "上長関係の履歴を更新できません",
            "lifecycle_projection_mismatch",
            { cause: change },
          )
        resources.push(...change.resources)
        if (!existing.includes(scope) && change.resources.length > 0)
          bindings.push(
            this.c
              .prepare(`INSERT INTO company_personnel_reporting_bindings
            (resource_id, employee_id, employment_id, organization_unit_id, assignment_type, recorded_by_action_id)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)`)
              .bind(
                scope.resource_id,
                scope.employee_id,
                scope.employment_id,
                scope.organization_unit_id,
                scope.assignment_type,
                props.action.id,
              ),
          )
      }
      if (props.projection.mutations.some((mutation) => mutation.periodType === "employment")) {
        const dependentIds = new Set(
          history
            .filter(
              (resource) =>
                resource.readText("employeeId") === props.action.employeeId ||
                resource.readText("managerEmployeeId") === props.action.employeeId,
            )
            .map((resource) => resource.id),
        )
        for (const resourceId of dependentIds) {
          if (scopes.some((scope) => scope.resource_id === resourceId)) continue
          const versions = history.filter((resource) => resource.id === resourceId)
          const original = correction.filter((row) => row.resource_id === resourceId)
          if (
            original.length > 0 &&
            versions.some(
              (resource) => resource.revision > Math.max(...original.map((row) => row.revision)),
            )
          )
            return new CompanyConflictError(
              "訂正対象の上長関係は後続の変更を受けています",
              "personnel_action_stale",
            )
          const basis =
            original.length === 0
              ? versions
              : versions.filter(
                  (resource) =>
                    resource.revision < Math.min(...original.map((row) => row.revision)),
                )
          const change = CompanyReportingEmploymentChangeValue.create({
            employeeId: props.action.employeeId,
            history: versions,
            basis,
            employments: props.projection.schedule.employments
              .filter((period) => !period.isVoid)
              .map((period) => this.period(period)),
          })
          if (change instanceof Error)
            return new CompanyValidationError(
              "雇用変更後の上長関係を準備できません",
              "lifecycle_projection_mismatch",
              { cause: change },
            )
          resources.push(...change.resources)
        }
      }
      const validation = await this.validate(props, periodIds, history, resources)
      return validation ?? { resources, bindings, summary }
    } catch (cause) {
      return new CompanyUnexpectedError("人事発令の上長履歴を準備できません", { cause })
    }
  }

  private matches(scope: Binding, period: OrgAssignmentPeriod): boolean {
    return (
      scope.employee_id === period.employeeId &&
      scope.employment_id === period.employmentPeriodId &&
      scope.organization_unit_id === period.organizationUnitId &&
      scope.assignment_type === (period.assignmentType === "primary" ? "PRIMARY" : "CONCURRENT")
    )
  }

  private period(period: Readonly<{ startsOn: string; endsOn: string | null }>) {
    return {
      startsOn: restoreCalendarDate(period.startsOn),
      endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
    }
  }

  private replacementPeriod(
    period: OrgAssignmentPeriod,
    history: ReadonlyArray<CompanyResourceEntity>,
  ) {
    const current = history
      .filter((resource) => resource.effectiveFrom <= period.startsOn)
      .toSorted(
        (left, right) =>
          right.effectiveFrom.localeCompare(left.effectiveFrom) || right.revision - left.revision,
      )[0]
    const boundaries = [
      period.endsOn,
      current?.effectiveTo,
      ...history.map((resource) => resource.effectiveFrom),
    ]
      .filter((date) => date !== null && date !== undefined)
      .filter((date) => date > period.startsOn)
      .sort((left, right) => left.localeCompare(right))
    return this.period({ startsOn: period.startsOn, endsOn: boundaries[0] ?? null })
  }

  private async correctionRevisions(actionId: string | null) {
    if (actionId === null) return []
    const prefix = `lifecycle:${actionId}:`
    const result = await this.c
      .prepare(`SELECT resource_id, revision FROM company_resource_revisions
      WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'reporting-relation'
        AND substr(command_id, 1, length(?1)) = ?1`)
      .bind(prefix)
      .all()
    if (!result.success) return new Error("Original reporting revisions are unavailable")
    return z
      .array(z.object({ resource_id: z.string(), revision: z.number().int().positive() }))
      .parse(result.results)
  }

  private async validate(
    props: PersonnelActionPersistenceProps,
    periodIds: ReadonlySet<string>,
    history: ReadonlyArray<CompanyResourceEntity>,
    resources: ReadonlyArray<CompanyResourceEntity>,
  ): Promise<CompanyOperationError | null> {
    const timeline = CompanyReportingRelationTimelineValue.create([...history, ...resources])
    if (timeline instanceof Error)
      return new CompanyValidationError("指揮命令の履歴が不正です", "lifecycle_projection_mismatch")
    const selected = await this.c
      .prepare(`SELECT period_id, employee_id, manager_employee_id,
      organization_unit_id, starts_on, ends_on FROM company_organization_assignment_period_versions period
      WHERE period.revision = (SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest
        WHERE latest.period_id = period.period_id) AND period.is_void = 0 AND period.manager_employee_id IS NOT NULL`)
      .all<{
        period_id: string
        employee_id: string
        manager_employee_id: string
        organization_unit_id: string
        starts_on: string
        ends_on: string | null
      }>()
    if (!selected.success) throw new Error("Legacy reporting periods are unavailable")
    const mutations = props.projection.mutations.filter(
      (mutation) => mutation.periodType === "assignment",
    )
    const affected = new Set(mutations.map((mutation) => mutation.after.periodId))
    const legacy: OrganizationRelation[] = selected.results
      .filter((row) => !affected.has(row.period_id))
      .map((row) => ({
        employeeId: row.employee_id,
        managerEmployeeId: row.manager_employee_id,
        organizationUnitId: row.organization_unit_id,
        startsOn: row.starts_on,
        endsOn: row.ends_on,
      }))
    for (const mutation of mutations) {
      const period = mutation.after
      if (!period.isVoid && period.managerEmployeeId !== null && !periodIds.has(period.periodId))
        legacy.push({ ...period, managerEmployeeId: period.managerEmployeeId })
    }
    if (timeline.hasManagementCycle(legacy))
      return new CompanyValidationError(
        "人事発令後の指揮命令が循環します",
        "personnel_action_invalid_transition",
      )
    if (
      timeline
        .readPeriods()
        .some((relation) =>
          legacy.some(
            (other) =>
              relation.employeeId === other.employeeId &&
              relation.organizationUnitId === other.organizationUnitId &&
              (relation.endsOn === null || other.startsOn < relation.endsOn) &&
              (other.endsOn === null || relation.startsOn < other.endsOn),
          ),
        )
    )
      return new CompanyValidationError(
        "未接続の所属と公開の上長関係が重複しています",
        "lifecycle_projection_mismatch",
      )
    const employment = await this.c
      .prepare(`SELECT employee_id, starts_on, ends_on FROM company_employment_period_versions period
      WHERE period.revision = (SELECT max(latest.revision) FROM company_employment_period_versions latest
        WHERE latest.period_id = period.period_id) AND period.is_void = 0`)
      .all<{
        employee_id: string
        starts_on: string
        ends_on: string | null
      }>()
    if (!employment.success) throw new Error("Reporting employment periods are unavailable")
    const employments = [
      ...employment.results
        .filter((row) => row.employee_id !== props.action.employeeId)
        .map((row) => ({
          employeeId: row.employee_id,
          startsOn: row.starts_on,
          endsOn: row.ends_on,
        })),
      ...props.projection.schedule.employments.filter((period) => !period.isVoid),
    ]
    const changedIds = new Set(resources.map((resource) => resource.id))
    const managers = [
      ...new Set(
        resources
          .filter((resource) => resource.state === "active")
          .flatMap((resource) => {
            const id = resource.readText("managerEmployeeId")
            return id === null ? [] : [id]
          }),
      ),
    ]
    const connected = await this.c
      .prepare(`SELECT resource_id FROM company_workforce_resource_bindings
      WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'employee'
        AND resource_id IN (SELECT value FROM json_each(?1))`)
      .bind(JSON.stringify(managers))
      .all<{ resource_id: string }>()
    if (!connected.success) throw new Error("Manager resource bindings are unavailable")
    if (managers.some((id) => !connected.results.some((row) => row.resource_id === id)))
      return new CompanyValidationError(
        "上長の従業員履歴が未接続です",
        "lifecycle_projection_mismatch",
      )
    const changed = CompanyReportingRelationTimelineValue.create([
      ...history.filter((resource) => changedIds.has(resource.id)),
      ...resources,
    ])
    if (changed instanceof Error) throw changed
    for (const relation of changed.readPeriods()) {
      for (const employeeId of [relation.employeeId, relation.managerEmployeeId]) {
        if (
          !periodsContainPeriod(
            employments
              .filter((period) => period.employeeId === employeeId)
              .map((period) => this.period(period)),
            this.period(relation),
          )
        )
          return new CompanyValidationError(
            "上長関係を雇用期間が覆っていません",
            "personnel_action_invalid_transition",
          )
      }
    }
    return null
  }
}
