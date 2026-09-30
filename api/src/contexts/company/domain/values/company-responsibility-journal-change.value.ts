import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import type { CompanyResponsibilitySource } from "@/contexts/company/domain/values/company-responsibility-resource-timeline.value"
import { CompanyResponsibilityResourceTimelineValue } from "@/contexts/company/domain/values/company-responsibility-resource-timeline.value"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Props = Readonly<{
  resourceId: string
  source: CompanyResponsibilitySource
  history: ReadonlyArray<CompanyResourceEntity>
  periods: ReadonlyArray<OrgResponsibilityPeriod>
}>

/** 発令後の責務期間を公開履歴へ記録し、過去の訂正と将来予約を保つ。 */
export class CompanyResponsibilityJournalChangeValue {
  private constructor(readonly resources: ReadonlyArray<CompanyResourceEntity>) {
    Object.freeze(this)
  }

  static create(props: Props): CompanyResponsibilityJournalChangeValue | Error {
    const history = props.history.toSorted((left, right) => left.revision - right.revision)
    if (history.some((resource) => resource.id !== props.resourceId))
      return new CompanyResourceValidationError("invalid_resource")
    if (
      history.length > 0 &&
      CompanyResponsibilityResourceTimelineValue.create(history, props.source) instanceof Error
    )
      return new CompanyResourceValidationError("invalid_resource")
    if (
      props.periods.some(
        (period) =>
          period.employeeId !== props.source.employeeId ||
          period.employmentId !== props.source.employmentId ||
          period.organizationUnitId !== props.source.organizationUnitId ||
          period.responsibilityType !== props.source.responsibilityType ||
          (period.endsOn !== null && period.endsOn <= period.startsOn),
      )
    )
      return new CompanyResourceValidationError("invalid_resource")
    const boundaries = [
      ...new Set(
        [
          ...history,
          ...props.periods.map((period) => ({
            effectiveFrom: period.startsOn,
            effectiveTo: period.endsOn,
          })),
        ]
          .flatMap((resource) => [resource.effectiveFrom, resource.effectiveTo])
          .filter((date) => date !== null),
      ),
    ].sort()
    const resources: CompanyResourceEntity[] = []
    for (const [index, date] of boundaries.entries()) {
      const current = history
        .filter((resource) => resource.effectiveFrom <= date)
        .toSorted(
          (left, right) =>
            right.effectiveFrom.localeCompare(left.effectiveFrom) || right.revision - left.revision,
        )[0]
      const active = props.periods.filter(
        (period) =>
          !period.isVoid &&
          period.startsOn <= date &&
          (period.endsOn === null || date < period.endsOn),
      )
      if (active.length > 1) return new CompanyResourceValidationError("invalid_period")
      const state = active.length === 0 ? "void" : "active"
      const end = boundaries[index + 1] ?? null
      if (current?.effectiveFrom === date && current.effectiveTo === end && current.state === state)
        continue
      const resource = CompanyResourceEntity.create({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "responsibility-assignment",
        id: props.resourceId,
        revision: history.length + resources.length + 1,
        state,
        effectiveFrom: date,
        effectiveTo: end,
        attributes: {
          responsibilityId: props.source.responsibilityId,
          holderType: "employee",
          holderId: props.source.employeeId,
          authorityScopeId: props.source.authorityScopeId,
          delegationAllowed: current?.attributes.delegationAllowed ?? false,
        },
      })
      if (resource instanceof Error) return resource
      resources.push(resource)
    }
    return new CompanyResponsibilityJournalChangeValue(Object.freeze(resources))
  }
}
