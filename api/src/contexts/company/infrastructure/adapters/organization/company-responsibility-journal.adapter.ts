import { z } from "zod"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { CompanyResponsibilitySource } from "@/contexts/company/domain/values/company-responsibility-resource-timeline.value"
import { CompanyResponsibilityJournalChangeValue } from "@/contexts/company/domain/values/company-responsibility-journal-change.value"
import { CompanyResponsibilityResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-responsibility-resource-history.adapter"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyConflictError, CompanyValidationError } from "@/contexts/company/domain/errors"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const rowSchema = z.object({
  resource_id: z.string(),
  resource_revision: z.number().int().positive(),
  responsibility_id: z.string(),
  authority_scope_id: z.string(),
  period_revision: z.number().int().positive(),
  period_id: z.string(),
  revision: z.number().int().positive(),
  employee_id: z.string(),
  employment_id: z.string(),
  organization_unit_id: z.string(),
  responsibility_type: z.string(),
  starts_on: z.string().date(),
  ends_on: z.string().date().nullable(),
  is_void: z.number().int().min(0).max(1),
  recorded_by_action_id: z.string(),
  recorded_at: z.number().int().nonnegative(),
})
type Context = D1Database
type Props = Readonly<{
  employeeId: OrgResponsibilityPeriod["employeeId"]
  changes: ReadonlyArray<
    Readonly<{ before: OrgResponsibilityPeriod | null; after: OrgResponsibilityPeriod }>
  >
  recordedAt: number
  correctsActionId: string | null
  connectNew: boolean
  newOrganizationUnitIds: ReadonlySet<string>
}>

/** 初期化と発令の責務を公開履歴へ接続し、確認済みの期間と対応だけを更新する。 */
export class CompanyResponsibilityJournalAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(props: Props) {
    const selected = await this.c
      .prepare(`SELECT period.*, binding.resource_id, binding.period_revision,
      source.resource_revision, source.responsibility_id, source.authority_scope_id
      FROM company_responsibility_period_bindings binding
      JOIN company_responsibility_resource_bindings source ON source.resource_id = binding.resource_id
      JOIN company_organization_responsibility_period_versions period ON period.period_id = binding.period_id
      WHERE source.employee_id = ?1 AND period.revision = (SELECT max(latest.revision) FROM company_organization_responsibility_period_versions latest WHERE latest.period_id = period.period_id)
      ORDER BY period.period_id`)
      .bind(props.employeeId)
      .all()
    if (!selected.success) return new Error("responsibility bindings unavailable")
    const parsed = z.array(rowSchema).safeParse(selected.results)
    if (!parsed.success) return parsed.error
    if (
      parsed.data.some(
        (row) => row.revision !== row.period_revision || row.employee_id !== props.employeeId,
      )
    )
      return new CompanyConflictError(
        "責務の対応する版が更新されています",
        "personnel_action_stale",
      )
    const byPeriod = new Map(parsed.data.map((row) => [row.period_id, row]))
    const resourceIds = new Set(parsed.data.map((row) => row.resource_id))
    const pendingPeriods = new Map<string, string>()
    const groups = new Map<
      string,
      { source: CompanyResponsibilitySource; periods: Map<string, OrgResponsibilityPeriod> }
    >()
    const resources: CompanyResourceEntity[] = []
    const definitions = new Map<string, CompanyResourceEntity>()
    for (const change of props.changes.toSorted((left, right) =>
      left.after.startsOn.localeCompare(right.after.startsOn),
    )) {
      const prior = byPeriod.get(change.after.periodId)
      if (
        prior === undefined &&
        !pendingPeriods.has(change.after.periodId) &&
        (change.before !== null || !props.connectNew)
      )
        continue
      const period = change.after
      const resourceId =
        prior?.resource_id ?? pendingPeriods.get(period.periodId) ?? crypto.randomUUID()
      pendingPeriods.set(period.periodId, resourceId)
      const responsibility =
        prior === undefined
          ? await this.definition(period, "responsibility", definitions)
          : prior.responsibility_id
      if (responsibility instanceof Error) return responsibility
      const scope =
        prior === undefined
          ? await this.definition(period, "authority-scope", definitions)
          : prior.authority_scope_id
      if (scope instanceof Error) return scope
      if (prior === undefined && !props.newOrganizationUnitIds.has(period.organizationUnitId)) {
        const unit = await this.c
          .prepare(
            "SELECT organization_id FROM company_organization_resource_bindings WHERE organization_unit_id = ?1",
          )
          .bind(period.organizationUnitId)
          .first<string>("organization_id")
        if (unit !== COMPANY_DEFAULT_ORGANIZATION_ID)
          return new CompanyValidationError(
            "責務を割り当てる組織履歴が未接続です",
            "lifecycle_projection_mismatch",
          )
      }
      const source: CompanyResponsibilitySource = {
        employeeId: period.employeeId,
        employmentId: period.employmentId,
        organizationUnitId: period.organizationUnitId,
        responsibilityType: period.responsibilityType,
        responsibilityId: responsibility,
        authorityScopeId: scope,
      }
      const group = groups.get(resourceId) ?? {
        source,
        periods: new Map(
          parsed.data
            .filter((row) => row.resource_id === resourceId)
            .map((row) => [row.period_id, this.period(row)]),
        ),
      }
      group.periods.set(period.periodId, period)
      groups.set(resourceId, group)
      resourceIds.add(resourceId)
    }
    resources.push(...definitions.values())
    const bindings: D1PreparedStatement[] = []
    for (const [resourceId, group] of groups) {
      const history = await new CompanyResponsibilityResourceHistoryAdapter(this.c).read({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        id: resourceId,
      })
      if (history instanceof Error) return history
      const prior = parsed.data.find((row) => row.resource_id === resourceId)
      if ((prior?.resource_revision ?? 0) !== history.length)
        return new CompanyConflictError("公開責務の版が更新されています", "personnel_action_stale")
      if (props.correctsActionId !== null) {
        const prefix = `lifecycle:${props.correctsActionId}:`
        const lastRevision = await this.c
          .prepare(`SELECT max(revision) AS revision FROM company_resource_revisions
          WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = 'responsibility-assignment' AND resource_id = ?1
            AND substr(command_id, 1, length(?2)) = ?2`)
          .bind(resourceId, prefix)
          .first<number | null>("revision")
        if (lastRevision !== null && history.some((resource) => resource.revision > lastRevision))
          return new CompanyConflictError(
            "訂正対象の責務は後続の変更を受けています",
            "personnel_action_stale",
          )
      }
      const changed = CompanyResponsibilityJournalChangeValue.create({
        resourceId,
        source: group.source,
        history,
        periods: [...group.periods.values()],
      })
      if (changed instanceof Error) return changed
      resources.push(...changed.resources)
      const revision = changed.resources.at(-1)?.revision ?? history.length
      bindings.push(
        this.c
          .prepare(`INSERT INTO company_responsibility_resource_bindings
        (resource_id, organization_id, employee_id, employment_id, organization_unit_id, responsibility_type, responsibility_id, authority_scope_id, resource_revision, recorded_at)
        VALUES (?1, '${COMPANY_DEFAULT_ORGANIZATION_ID}', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
        ON CONFLICT (resource_id) DO UPDATE SET resource_revision = excluded.resource_revision, recorded_at = excluded.recorded_at`)
          .bind(
            resourceId,
            group.source.employeeId,
            group.source.employmentId,
            group.source.organizationUnitId,
            group.source.responsibilityType,
            group.source.responsibilityId,
            group.source.authorityScopeId,
            revision,
            props.recordedAt,
          ),
      )
      for (const period of group.periods.values()) {
        const source = [...history, ...changed.resources]
          .filter((resource) => resource.effectiveFrom <= period.startsOn)
          .toSorted(
            (left, right) =>
              right.effectiveFrom.localeCompare(left.effectiveFrom) ||
              right.revision - left.revision,
          )[0]
        if (source === undefined) return new Error("responsibility source history missing")
        bindings.push(
          this.c
            .prepare(`INSERT INTO company_responsibility_period_bindings (period_id, resource_id, period_revision, source_revision)
          VALUES (?1, ?2, ?3, ?4) ON CONFLICT (period_id) DO UPDATE SET period_revision = excluded.period_revision, source_revision = excluded.source_revision`)
            .bind(period.periodId, resourceId, period.revision, source.revision),
        )
      }
    }
    return { resources, bindings, resourceIds }
  }

  private async definition(
    period: OrgResponsibilityPeriod,
    type: "responsibility" | "authority-scope",
    pending: Map<string, CompanyResourceEntity>,
  ): Promise<string | Error> {
    const key = `${type}:${type === "responsibility" ? period.responsibilityType : period.organizationUnitId}`
    const cached = pending.get(key)
    if (cached !== undefined) return cached.id
    const row = await this.c
      .prepare(`SELECT resource_id, revision, state, effective_from, effective_to, attributes_json FROM company_resource_heads
      WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' AND resource_type = ?1 AND
      ((?1 = 'responsibility' AND json_extract(attributes_json, '$.code') = ?2)
        OR (?1 = 'authority-scope' AND json_extract(attributes_json, '$.scopeType') = 'organization-unit' AND json_extract(attributes_json, '$.scopeId') = ?3))
      ORDER BY resource_id LIMIT 1`)
      .bind(type, period.responsibilityType, period.organizationUnitId)
      .first<{
        resource_id: string
        state: string
        effective_from: string
        effective_to: string | null
      }>()
    if (row !== null) {
      if (
        row.state !== "active" ||
        row.effective_from > period.startsOn ||
        (row.effective_to !== null && (period.endsOn === null || period.endsOn > row.effective_to))
      )
        return new CompanyValidationError(
          "責務定義の有効期間を確認してください",
          "lifecycle_projection_mismatch",
        )
      return row.resource_id
    }
    const resource = CompanyResourceEntity.create({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type,
      id: `${type}:${crypto.randomUUID()}`,
      revision: 1,
      state: "active",
      effectiveFrom: period.startsOn,
      effectiveTo: null,
      attributes:
        type === "responsibility"
          ? { code: period.responsibilityType, officialName: period.responsibilityType }
          : { scopeType: "organization-unit", scopeId: period.organizationUnitId },
    })
    if (resource instanceof Error) return resource
    pending.set(key, resource)
    return resource.id
  }

  private period(row: z.infer<typeof rowSchema>): OrgResponsibilityPeriod {
    return {
      periodId: restoreWorkforceId("period", row.period_id),
      revision: row.revision,
      employeeId: restoreWorkforceId("employee", row.employee_id),
      employmentId: restoreWorkforceId("employment", row.employment_id),
      organizationUnitId: restoreWorkforceId("organization_unit", row.organization_unit_id),
      responsibilityType: restoreOrgResponsibilityType(row.responsibility_type),
      startsOn: restoreCalendarDate(row.starts_on),
      endsOn: row.ends_on === null ? null : restoreCalendarDate(row.ends_on),
      isVoid: row.is_void === 1,
      recordedByActionId: restoreWorkforceId("personnel_action", row.recorded_by_action_id),
      recordedAt: row.recorded_at,
    }
  }
}
