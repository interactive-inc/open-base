import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import type { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type {
  PersonnelActionId,
  WorkforcePeriodId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CompanyResponsibilityResourceTimelineValue } from "@/contexts/company/domain/values/company-responsibility-resource-timeline.value"
import { CompanyResponsibilityResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-responsibility-resource-history.adapter"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const date = z.string().refine(isCalendarDate)
const periodRow = z.object({
  period_id: z.string(),
  revision: z.number().int().positive(),
  expected_revision: z.number().int().positive(),
  employee_id: z.string(),
  employment_id: z.string(),
  organization_unit_id: z.string(),
  responsibility_type: z.string(),
  starts_on: date,
  ends_on: date.nullable(),
  is_void: z.number().int().min(0).max(1),
  recorded_by_action_id: z.string(),
  recorded_at: z.number().int().nonnegative(),
})
type Context = D1Database
export type PreparedCompanyResponsibilities = Readonly<{
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
  bindings: ReadonlyArray<D1PreparedStatement>
}>

/** 公開責務の全期間を既存の組織operationへ渡し、期間ごとの対応と版を固定する。 */
export class CompanyResponsibilityResourceProjectionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    change: CompanyResourceChangeEntity,
    operationId: PersonnelActionId,
  ): Promise<PreparedCompanyResponsibilities | Error> {
    const responsibilities: OrgResponsibilityPeriod[] = []
    const bindings: D1PreparedStatement[] = []
    for (const resource of change.resources.filter(
      (resource) => resource.type === "responsibility-assignment",
    )) {
      if (resource.organizationId !== COMPANY_DEFAULT_ORGANIZATION_ID)
        return new CompanyResourceValidationError("invalid_resource")
      const rows = await this.c.batch([
        this.c
          .prepare(
            "SELECT organization_id, employee_id, employment_id, organization_unit_id, responsibility_type, responsibility_id, authority_scope_id, resource_revision FROM company_responsibility_resource_bindings WHERE resource_id = ?1",
          )
          .bind(resource.id),
        this.c
          .prepare(`SELECT period.*, binding.period_revision AS expected_revision
          FROM company_responsibility_period_bindings binding
          JOIN company_organization_responsibility_period_versions period ON period.period_id = binding.period_id
          WHERE binding.resource_id = ?1 AND period.revision = (SELECT max(latest.revision) FROM company_organization_responsibility_period_versions latest WHERE latest.period_id = period.period_id)
          ORDER BY period.period_id`)
          .bind(resource.id),
      ])
      if (rows.length !== 2 || rows.some((row) => !row.success))
        return new Error("failed to read responsibility projection snapshot")
      const binding = z
        .object({
          organization_id: z.string(),
          employee_id: z.string(),
          employment_id: z.string(),
          organization_unit_id: z.string(),
          responsibility_type: z.string(),
          responsibility_id: z.string(),
          authority_scope_id: z.string(),
          resource_revision: z.number().int().positive(),
        })
        .nullable()
        .safeParse(rows[0]?.results[0] ?? null)
      const periods = z.array(periodRow).safeParse(rows[1]?.results)
      if (!binding.success || !periods.success)
        return new CompanyResourceValidationError("invalid_resource")
      if (binding.data === null) continue
      const source = {
        employeeId: restoreWorkforceId("employee", binding.data.employee_id),
        employmentId: restoreWorkforceId("employment", binding.data.employment_id),
        organizationUnitId: restoreWorkforceId(
          "organization_unit",
          binding.data.organization_unit_id,
        ),
        responsibilityType: restoreOrgResponsibilityType(binding.data.responsibility_type),
        responsibilityId: binding.data.responsibility_id,
        authorityScopeId: binding.data.authority_scope_id,
      }
      const history = await new CompanyResponsibilityResourceHistoryAdapter(this.c).read(resource)
      if (history instanceof Error) return history
      const timeline = CompanyResponsibilityResourceTimelineValue.create(
        [...history, resource],
        source,
      )
      if (timeline instanceof Error) return timeline
      if (
        binding.data !== null &&
        (binding.data.organization_id !== resource.organizationId ||
          binding.data.employee_id !== source.employeeId ||
          binding.data.resource_revision !== resource.revision - 1)
      )
        return new CompanyResourceValidationError("invalid_revision")
      if (
        periods.data.some(
          (period) =>
            period.revision !== period.expected_revision ||
            period.employee_id !== source.employeeId ||
            period.employment_id !== source.employmentId ||
            period.organization_unit_id !== source.organizationUnitId ||
            period.responsibility_type !== source.responsibilityType,
        )
      )
        return new CompanyResourceValidationError("invalid_revision")
      const current = new Map(
        periods.data.map((period) => [period.period_id, this.toPeriod(period)]),
      )
      const target = new Map<
        WorkforcePeriodId,
        { period: OrgResponsibilityPeriod; sourceRevision: number }
      >()
      for (const segment of timeline.segments) {
        const matching = [...current.values()]
          .filter(
            (period) =>
              period.startsOn === segment.startsOn &&
              period.employeeId === segment.employeeId &&
              period.employmentId === segment.employmentId &&
              period.organizationUnitId === segment.organizationUnitId &&
              period.responsibilityType === segment.responsibilityType,
          )
          .toSorted((left, right) => Number(left.isVoid) - Number(right.isVoid))
        const periodId = matching[0]?.periodId ?? (await this.periodId(resource.id, segment))
        const previous = current.get(periodId)
        target.set(periodId, {
          sourceRevision: segment.resourceRevision,
          period: {
            periodId,
            revision: previous?.revision ?? 0,
            employeeId: segment.employeeId,
            employmentId: segment.employmentId,
            organizationUnitId: segment.organizationUnitId,
            responsibilityType: segment.responsibilityType,
            startsOn: segment.startsOn,
            endsOn: segment.endsOn,
            isVoid: false,
            recordedByActionId: operationId,
            recordedAt: change.recordedAt,
          },
        })
      }
      const final = new Map<
        WorkforcePeriodId,
        { period: OrgResponsibilityPeriod; sourceRevision: number }
      >()
      for (const previous of current.values()) {
        const next = target.get(previous.periodId)
        if (!previous.isVoid && (next === undefined || !this.samePeriod(previous, next.period))) {
          const voided = {
            ...previous,
            revision: previous.revision + 1,
            isVoid: true,
            recordedByActionId: operationId,
            recordedAt: change.recordedAt,
          }
          responsibilities.push(voided)
          final.set(previous.periodId, { period: voided, sourceRevision: resource.revision })
        } else
          final.set(previous.periodId, {
            period: previous,
            sourceRevision: next?.sourceRevision ?? resource.revision,
          })
      }
      for (const next of target.values()) {
        const previous = final.get(next.period.periodId)?.period
        if (previous !== undefined && this.samePeriod(previous, next.period)) continue
        const period = { ...next.period, revision: (previous?.revision ?? 0) + 1 }
        responsibilities.push(period)
        final.set(period.periodId, { period, sourceRevision: next.sourceRevision })
      }
      bindings.push(
        this.c
          .prepare(
            "UPDATE company_responsibility_resource_bindings SET resource_revision = ?2, recorded_at = ?3 WHERE resource_id = ?1",
          )
          .bind(resource.id, resource.revision, change.recordedAt),
      )
      for (const entry of final.values()) {
        bindings.push(
          this.c
            .prepare(`INSERT INTO company_responsibility_period_bindings (period_id, resource_id, period_revision, source_revision)
          VALUES (?1, ?2, ?3, ?4) ON CONFLICT (period_id) DO UPDATE SET period_revision = excluded.period_revision, source_revision = excluded.source_revision`)
            .bind(entry.period.periodId, resource.id, entry.period.revision, entry.sourceRevision),
        )
      }
    }
    return { responsibilities, bindings }
  }

  private samePeriod(left: OrgResponsibilityPeriod, right: OrgResponsibilityPeriod): boolean {
    return (
      left.isVoid === right.isVoid &&
      left.startsOn === right.startsOn &&
      left.endsOn === right.endsOn
    )
  }

  private async periodId(
    resourceId: string,
    segment: CompanyResponsibilityResourceTimelineValue["segments"][number],
  ): Promise<WorkforcePeriodId> {
    const fingerprint = new TextEncoder().encode(
      JSON.stringify([
        resourceId,
        segment.startsOn,
        segment.employeeId,
        segment.employmentId,
        segment.organizationUnitId,
        segment.responsibilityType,
      ]),
    )
    const digest = await crypto.subtle.digest("SHA-256", fingerprint)
    const hex = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")
    return restoreWorkforceId(
      "period",
      deterministicCompanyId("responsibility-resource-period", hex),
    )
  }

  private toPeriod(row: z.infer<typeof periodRow>): OrgResponsibilityPeriod {
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
