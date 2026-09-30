import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

type Props = Readonly<{
  resourceId: string
  history: ReadonlyArray<CompanyResourceEntity>
  periods: ReadonlyArray<OrgAssignmentPeriod>
}>

/** 発令後の所属期間を公開履歴へ戻し、過去の境界と将来予約を保全する。 */
export class CompanyAssignmentJournalChangeValue {
  readonly resources: ReadonlyArray<CompanyResourceEntity>

  private constructor(resources: ReadonlyArray<CompanyResourceEntity>) {
    this.resources = Object.freeze([...resources])
    Object.freeze(this)
  }

  static create(props: Props): CompanyAssignmentJournalChangeValue | Error {
    const first = props.periods[0]
    if (first === undefined) return new CompanyResourceValidationError("invalid_resource")
    const history = props.history.toSorted((left, right) => left.revision - right.revision)
    if (
      history.some(
        (resource, index) =>
          resource.revision !== index + 1 ||
          resource.type !== "assignment" ||
          resource.id !== props.resourceId ||
          resource.organizationId !== COMPANY_DEFAULT_ORGANIZATION_ID ||
          resource.readText("employeeId") !== first.employeeId,
      )
    )
      return new CompanyResourceValidationError("invalid_resource")
    if (
      props.periods.some(
        (period) =>
          period.employeeId !== first.employeeId ||
          period.managerEmployeeId !== null ||
          (period.endsOn !== null && period.endsOn <= period.startsOn),
      )
    )
      return new CompanyResourceValidationError("invalid_resource")
    const boundaries = [
      ...new Set([
        ...history.map((resource) => resource.effectiveFrom),
        ...props.periods.map((period) => period.startsOn),
        ...[
          ...history.map((resource) => resource.effectiveTo),
          ...props.periods.map((period) => period.endsOn),
        ].filter((date) => date !== null),
      ]),
    ].sort()
    const resources: CompanyResourceEntity[] = []
    for (const [index, date] of boundaries.entries()) {
      const current = history
        .filter((resource) => resource.effectiveFrom <= date)
        .toSorted(
          (left, right) =>
            right.effectiveFrom.localeCompare(left.effectiveFrom) || right.revision - left.revision,
        )[0]
      const periods = props.periods.filter(
        (period) =>
          !period.isVoid &&
          period.startsOn <= date &&
          (period.endsOn === null || date < period.endsOn),
      )
      if (periods.length > 1) return new CompanyResourceValidationError("invalid_period")
      const period = periods[0]
      const attributes = {
        ...(current?.attributes ?? history[0]?.attributes),
        employeeId: first.employeeId,
        employmentId:
          period?.employmentId ?? current?.readText("employmentId") ?? first.employmentId,
        organizationUnitId:
          period?.organizationUnitId ??
          current?.readText("organizationUnitId") ??
          first.organizationUnitId,
        assignmentType:
          period?.assignmentType ?? current?.readText("assignmentType") ?? first.assignmentType,
        positionTitle:
          period === undefined
            ? (current?.readNullableText("positionTitle") ?? first.positionTitle)
            : period.positionTitle,
      }
      const state = period === undefined ? "void" : "active"
      const end = boundaries[index + 1] ?? null
      const before = CanonicalSystemJsonValue.create(current?.attributes ?? null)
      const after = CanonicalSystemJsonValue.create(attributes)
      if (before instanceof Error || after instanceof Error)
        return new CompanyResourceValidationError("invalid_resource")
      if (
        current?.effectiveFrom === date &&
        current.effectiveTo === end &&
        current.state === state &&
        before.toString() === after.toString()
      )
        continue
      const resource = CompanyResourceEntity.create({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "assignment",
        id: props.resourceId,
        revision: history.length + resources.length + 1,
        state,
        effectiveFrom: date,
        effectiveTo: end,
        attributes,
      })
      if (resource instanceof Error) return resource
      resources.push(resource)
    }
    return new CompanyAssignmentJournalChangeValue(resources)
  }
}
