import type { AssignmentResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/assignment-resource-adoption-snapshot.value"
import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyPersonnelReportingChangeValue } from "@/contexts/company/domain/values/company-personnel-reporting-change.value"
import { CompanyReportingRelationTimelineValue } from "@/contexts/company/domain/values/company-reporting-relation-timeline.value"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"

export type AssignmentReportingAdoptionScope = Readonly<{
  resourceId: string
  employeeId: string
  employmentId: string
  organizationUnitId: string
  assignmentType: "PRIMARY" | "CONCURRENT"
}>
type Props = Readonly<{
  snapshot: AssignmentResourceAdoptionSnapshotValue
  history: ReadonlyArray<CompanyResourceEntity>
  scopes: ReadonlyArray<AssignmentReportingAdoptionScope>
}>

/** 未接続期間の上長だけを移し、同じ範囲の確認済み公開記録との重複を拒否する。 */
export class AssignmentReportingAdoptionChangeValue {
  readonly resources: ReadonlyArray<CompanyResourceEntity>
  readonly scopes: ReadonlyArray<AssignmentReportingAdoptionScope>

  private constructor(
    resources: ReadonlyArray<CompanyResourceEntity>,
    scopes: ReadonlyArray<AssignmentReportingAdoptionScope>,
  ) {
    this.resources = Object.freeze([...resources])
    this.scopes = Object.freeze(scopes.map((scope) => Object.freeze(scope)))
    Object.freeze(this)
  }

  static async create(props: Props): Promise<AssignmentReportingAdoptionChangeValue | Error> {
    const latest = new Map(
      props.snapshot.props.value.periods.map((period) => [period.periodId, period]),
    )
    const periods = [...latest.values()].filter((period) => period.isVoid === 0)
    const unbound = periods
      .filter((period) => period.resourceId === null && period.managerEmployeeId !== null)
      .toSorted(
        (left, right) =>
          left.startsOn.localeCompare(right.startsOn) ||
          left.periodId.localeCompare(right.periodId),
      )
    const timeline = CompanyReportingRelationTimelineValue.create(props.history)
    if (timeline instanceof Error) return timeline
    if (
      unbound.some((period) =>
        timeline
          .readPeriods()
          .some(
            (relation) =>
              relation.employeeId === period.employeeId &&
              relation.organizationUnitId === period.organizationUnitId &&
              (period.endsOn === null || relation.startsOn < period.endsOn) &&
              (relation.endsOn === null || period.startsOn < relation.endsOn),
          ),
      )
    )
      return new CompanyValidationError(
        "公開上長関係と未接続の上長履歴が重複しています",
        "invalid_assignment_adoption",
      )
    const resources: CompanyResourceEntity[] = []
    const scopes = [...props.scopes]
    for (const period of unbound) {
      if (period.managerEmployeeId === null) continue
      const canonical = CanonicalSystemJsonValue.create([
        period.employeeId,
        period.employmentId,
        period.organizationUnitId,
        period.assignmentType,
      ])
      if (canonical instanceof Error) return canonical
      const digest = await ProposalDigestValue.create(canonical)
      if (digest instanceof Error) return digest
      const existing = scopes.find((scope) => this.matches(scope, period))
      const scope = existing ?? {
        resourceId: deterministicCompanyId("reporting-adoption", digest.toString()),
        employeeId: period.employeeId,
        employmentId: period.employmentId,
        organizationUnitId: period.organizationUnitId,
        assignmentType: period.assignmentType,
      }
      if (
        existing === undefined &&
        props.history.some((resource) => resource.id === scope.resourceId)
      )
        return new CompanyValidationError(
          "移行先の上長IDが既に使われています",
          "invalid_assignment_adoption",
        )
      if (existing === undefined) scopes.push(scope)
      const history = [...props.history, ...resources].filter(
        (resource) => resource.id === scope.resourceId,
      )
      if (existing !== undefined && history.length === 0)
        return new CompanyValidationError(
          "接続済み上長の公開履歴が欠落しています",
          "invalid_assignment_adoption",
        )
      const change = CompanyPersonnelReportingChangeValue.create({
        resourceId: scope.resourceId,
        employeeId: scope.employeeId,
        organizationUnitId: scope.organizationUnitId,
        history,
        basis: history,
        coverage: periods
          .filter((candidate) => this.matches(scope, candidate))
          .map((candidate) => this.period(candidate)),
        replacement: { ...this.period(period), managerEmployeeId: period.managerEmployeeId },
      })
      if (change instanceof Error) return change
      resources.push(...change.resources)
    }
    return new AssignmentReportingAdoptionChangeValue(
      resources,
      scopes.filter((scope) => !props.scopes.includes(scope)),
    )
  }

  private static matches(
    scope: AssignmentReportingAdoptionScope,
    period: AssignmentResourceAdoptionSnapshotValue["props"]["value"]["periods"][number],
  ): boolean {
    return (
      scope.employeeId === period.employeeId &&
      scope.employmentId === period.employmentId &&
      scope.organizationUnitId === period.organizationUnitId &&
      scope.assignmentType === period.assignmentType
    )
  }

  private static period(period: Readonly<{ startsOn: string; endsOn: string | null }>) {
    return {
      startsOn: restoreCalendarDate(period.startsOn),
      endsOn: period.endsOn === null ? null : restoreCalendarDate(period.endsOn),
    }
  }
}
