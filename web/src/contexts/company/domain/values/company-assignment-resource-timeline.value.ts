import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"

type AssignmentSegment = Readonly<
  Pick<
    OrgAssignmentPeriod,
    | "employeeId"
    | "employmentId"
    | "organizationUnitId"
    | "assignmentType"
    | "positionTitle"
    | "startsOn"
    | "endsOn"
  > & { resourceRevision: number }
>

type Props = Readonly<{
  resourceId: string
  employeeId: OrgAssignmentPeriod["employeeId"]
  revision: number
  segments: ReadonlyArray<AssignmentSegment>
}>

/** 公開所属の全改訂を、将来予約と過去訂正を保全した半開期間へ復元する。 */
export class CompanyAssignmentResourceTimelineValue {
  readonly resourceId: string
  readonly employeeId: OrgAssignmentPeriod["employeeId"]
  readonly revision: number
  readonly segments: ReadonlyArray<AssignmentSegment>

  private constructor(props: Props) {
    this.resourceId = props.resourceId
    this.employeeId = props.employeeId
    this.revision = props.revision
    this.segments = Object.freeze(props.segments.map((segment) => Object.freeze(segment)))
    Object.freeze(this)
  }

  static create(
    history: ReadonlyArray<CompanyResourceEntity>,
  ): CompanyAssignmentResourceTimelineValue | CompanyResourceValidationError {
    const ordered = history.toSorted((left, right) => left.revision - right.revision)
    const first = ordered[0]
    if (first === undefined) return new CompanyResourceValidationError("invalid_resource")
    const latest = new Map<CalendarDate, CompanyResourceEntity>()
    for (const [index, resource] of ordered.entries()) {
      if (
        resource.type !== "assignment" ||
        resource.id !== first.id ||
        resource.organizationId !== first.organizationId ||
        resource.readText("employeeId") !== first.readText("employeeId")
      )
        return new CompanyResourceValidationError("invalid_resource")
      if (resource.revision !== index + 1)
        return new CompanyResourceValidationError("invalid_revision")
      latest.set(resource.effectiveFrom, resource)
    }
    const effective = [...latest.values()].toSorted((left, right) =>
      left.effectiveFrom.localeCompare(right.effectiveFrom),
    )
    const segments: AssignmentSegment[] = []
    try {
      const employeeId = restoreWorkforceId("employee", first.readText("employeeId") ?? "")
      for (const [index, resource] of effective.entries()) {
        if (resource.state === "void") continue
        const assignmentType = resource.readText("assignmentType")
        if (assignmentType !== "PRIMARY" && assignmentType !== "CONCURRENT")
          return new CompanyResourceValidationError("invalid_resource")
        const nextStart = effective[index + 1]?.effectiveFrom ?? null
        segments.push({
          employeeId,
          employmentId: restoreWorkforceId("employment", resource.readText("employmentId") ?? ""),
          organizationUnitId: restoreWorkforceId(
            "organization_unit",
            resource.readText("organizationUnitId") ?? "",
          ),
          assignmentType,
          positionTitle: resource.readNullableText("positionTitle") ?? null,
          startsOn: resource.effectiveFrom,
          endsOn:
            nextStart !== null &&
            (resource.effectiveTo === null || nextStart < resource.effectiveTo)
              ? nextStart
              : resource.effectiveTo,
          resourceRevision: resource.revision,
        })
      }
      return new CompanyAssignmentResourceTimelineValue({
        resourceId: first.id,
        employeeId,
        revision: ordered.length,
        segments,
      })
    } catch {
      return new CompanyResourceValidationError("invalid_resource")
    }
  }
}
