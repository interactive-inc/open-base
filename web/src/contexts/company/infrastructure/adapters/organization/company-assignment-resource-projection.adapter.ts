import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import type { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type {
  PersonnelActionId,
  WorkforcePeriodId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"
import { CompanyAssignmentResourceTimelineValue } from "@/contexts/company/domain/values/company-assignment-resource-timeline.value"
import { CompanyAssignmentResourceHistoryAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-assignment-resource-history.adapter"
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
  assignment_type: z.enum(["PRIMARY", "CONCURRENT"]),
  position_title: z.string().nullable(),
  manager_employee_id: z.string().nullable(),
  starts_on: date,
  ends_on: date.nullable(),
  is_void: z.number().int().min(0).max(1),
  recorded_by_action_id: z.string(),
  recorded_at: z.number().int().nonnegative(),
})
type Context = D1Database
export type PreparedCompanyAssignments = Readonly<{
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  bindings: ReadonlyArray<D1PreparedStatement>
}>

/** 公開所属の全期間を既存の組織operationへ渡し、期間ごとの正本と版を固定する。 */
export class CompanyAssignmentResourceProjectionAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async prepare(
    change: CompanyResourceChangeEntity,
    operationId: PersonnelActionId,
  ): Promise<PreparedCompanyAssignments | Error> {
    const assignments: OrgAssignmentPeriod[] = []
    const bindings: D1PreparedStatement[] = []
    for (const resource of change.resources.filter((resource) => resource.type === "assignment")) {
      if (resource.organizationId !== COMPANY_DEFAULT_ORGANIZATION_ID)
        return new CompanyResourceValidationError("invalid_resource")
      const history = await new CompanyAssignmentResourceHistoryAdapter(this.c).read(resource)
      if (history instanceof Error) return history
      const timeline = CompanyAssignmentResourceTimelineValue.create([...history, resource])
      if (timeline instanceof Error) return timeline
      const rows = await this.c.batch([
        this.c
          .prepare(
            "SELECT organization_id, employee_id, resource_revision FROM company_assignment_resource_bindings WHERE resource_id = ?1",
          )
          .bind(resource.id),
        this.c
          .prepare(`SELECT period.*, binding.period_revision AS expected_revision
          FROM company_assignment_period_bindings binding
          JOIN company_organization_assignment_period_versions period ON period.period_id = binding.period_id
          WHERE binding.resource_id = ?1 AND period.revision = (SELECT max(latest.revision) FROM company_organization_assignment_period_versions latest WHERE latest.period_id = period.period_id)
          ORDER BY period.period_id`)
          .bind(resource.id),
      ])
      if (rows.length !== 2 || rows.some((row) => !row.success))
        return new Error("failed to read assignment projection snapshot")
      const binding = z
        .object({
          organization_id: z.string(),
          employee_id: z.string(),
          resource_revision: z.number().int().positive(),
        })
        .nullable()
        .safeParse(rows[0]?.results[0] ?? null)
      const periods = z.array(periodRow).safeParse(rows[1]?.results)
      if (!binding.success || !periods.success)
        return new CompanyResourceValidationError("invalid_resource")
      if (
        binding.data !== null &&
        (binding.data.organization_id !== resource.organizationId ||
          binding.data.employee_id !== timeline.employeeId ||
          binding.data.resource_revision !== resource.revision - 1)
      )
        return new CompanyResourceValidationError("invalid_revision")
      if (
        periods.data.some(
          (period) =>
            period.revision !== period.expected_revision ||
            period.employee_id !== timeline.employeeId ||
            period.manager_employee_id !== null,
        )
      )
        return new CompanyResourceValidationError("invalid_revision")
      const current = new Map(
        periods.data.map((period) => [period.period_id, this.toPeriod(period)]),
      )
      const target = new Map<
        WorkforcePeriodId,
        { period: OrgAssignmentPeriod; sourceRevision: number }
      >()
      for (const segment of timeline.segments) {
        const matching = [...current.values()]
          .filter(
            (period) =>
              period.startsOn === segment.startsOn &&
              period.employeeId === segment.employeeId &&
              period.employmentId === segment.employmentId &&
              period.organizationUnitId === segment.organizationUnitId &&
              period.assignmentType === segment.assignmentType,
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
            assignmentType: segment.assignmentType,
            positionTitle: segment.positionTitle,
            managerEmployeeId: null,
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
        { period: OrgAssignmentPeriod; sourceRevision: number }
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
          assignments.push(voided)
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
        assignments.push(period)
        final.set(period.periodId, { period, sourceRevision: next.sourceRevision })
      }
      bindings.push(
        this.c
          .prepare(`INSERT INTO company_assignment_resource_bindings
        (resource_id, organization_id, employee_id, resource_revision, recorded_at) VALUES (?1, ?2, ?3, ?4, ?5)
        ON CONFLICT (resource_id) DO UPDATE SET resource_revision = excluded.resource_revision, recorded_at = excluded.recorded_at`)
          .bind(
            resource.id,
            resource.organizationId,
            timeline.employeeId,
            resource.revision,
            change.recordedAt,
          ),
      )
      for (const entry of final.values()) {
        bindings.push(
          this.c
            .prepare(`INSERT INTO company_assignment_period_bindings (period_id, resource_id, period_revision, source_revision)
          VALUES (?1, ?2, ?3, ?4) ON CONFLICT (period_id) DO UPDATE SET period_revision = excluded.period_revision, source_revision = excluded.source_revision`)
            .bind(entry.period.periodId, resource.id, entry.period.revision, entry.sourceRevision),
        )
      }
    }
    return { assignments, bindings }
  }

  private samePeriod(left: OrgAssignmentPeriod, right: OrgAssignmentPeriod): boolean {
    return (
      left.isVoid === right.isVoid &&
      left.startsOn === right.startsOn &&
      left.endsOn === right.endsOn &&
      left.positionTitle === right.positionTitle
    )
  }

  private async periodId(
    resourceId: string,
    segment: CompanyAssignmentResourceTimelineValue["segments"][number],
  ): Promise<WorkforcePeriodId> {
    const fingerprint = new TextEncoder().encode(
      JSON.stringify([
        resourceId,
        segment.startsOn,
        segment.employeeId,
        segment.employmentId,
        segment.organizationUnitId,
        segment.assignmentType,
      ]),
    )
    const digest = await crypto.subtle.digest("SHA-256", fingerprint)
    const hex = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("")
    return restoreWorkforceId("period", deterministicCompanyId("assignment-resource-period", hex))
  }

  private toPeriod(row: z.infer<typeof periodRow>): OrgAssignmentPeriod {
    return {
      periodId: restoreWorkforceId("period", row.period_id),
      revision: row.revision,
      employeeId: restoreWorkforceId("employee", row.employee_id),
      employmentId: restoreWorkforceId("employment", row.employment_id),
      organizationUnitId: restoreWorkforceId("organization_unit", row.organization_unit_id),
      assignmentType: row.assignment_type,
      positionTitle: row.position_title,
      managerEmployeeId: null,
      startsOn: restoreCalendarDate(row.starts_on),
      endsOn: row.ends_on === null ? null : restoreCalendarDate(row.ends_on),
      isVoid: row.is_void === 1,
      recordedByActionId: restoreWorkforceId("personnel_action", row.recorded_by_action_id),
      recordedAt: row.recorded_at,
    }
  }
}
