import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

export type CompanyResponsibilitySource = Readonly<{
  employeeId: OrgResponsibilityPeriod["employeeId"]
  employmentId: OrgResponsibilityPeriod["employmentId"]
  organizationUnitId: OrgResponsibilityPeriod["organizationUnitId"]
  responsibilityType: OrgResponsibilityPeriod["responsibilityType"]
  responsibilityId: string
  authorityScopeId: string
}>
type Segment = Readonly<
  CompanyResponsibilitySource &
    Pick<OrgResponsibilityPeriod, "startsOn" | "endsOn"> & { resourceRevision: number }
>

/** 接続済み責務の所有者を固定し、全改訂から有効な期間を復元する。 */
export class CompanyResponsibilityResourceTimelineValue {
  private constructor(readonly segments: ReadonlyArray<Segment>) {
    Object.freeze(this)
  }

  static create(
    history: ReadonlyArray<CompanyResourceEntity>,
    source: CompanyResponsibilitySource,
  ): CompanyResponsibilityResourceTimelineValue | Error {
    const ordered = history.toSorted((left, right) => left.revision - right.revision)
    const first = ordered[0]
    if (
      first === undefined ||
      ordered.some(
        (resource, index) =>
          resource.type !== "responsibility-assignment" ||
          resource.id !== first.id ||
          resource.organizationId !== COMPANY_DEFAULT_ORGANIZATION_ID ||
          resource.revision !== index + 1 ||
          resource.readText("holderType") !== "employee" ||
          resource.readText("holderId") !== source.employeeId ||
          resource.readText("responsibilityId") !== source.responsibilityId ||
          resource.readText("authorityScopeId") !== source.authorityScopeId,
      )
    )
      return new CompanyResourceValidationError("invalid_resource")
    const latest = new Map(ordered.map((resource) => [resource.effectiveFrom, resource]))
    const effective = [...latest.values()].toSorted((left, right) =>
      left.effectiveFrom.localeCompare(right.effectiveFrom),
    )
    const segments: Segment[] = []
    for (const [index, resource] of effective.entries()) {
      if (resource.state === "void") continue
      const nextStart = effective[index + 1]?.effectiveFrom ?? null
      segments.push(
        Object.freeze({
          ...source,
          startsOn: resource.effectiveFrom,
          endsOn:
            nextStart !== null &&
            (resource.effectiveTo === null || nextStart < resource.effectiveTo)
              ? nextStart
              : resource.effectiveTo,
          resourceRevision: resource.revision,
        }),
      )
    }
    return new CompanyResponsibilityResourceTimelineValue(Object.freeze(segments))
  }
}
