import type { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { OrganizationRelation } from "@/contexts/company/domain/definitions/organization-relation.definition"
import { hasManagementCycle } from "@/contexts/company/domain/definitions/has-management-cycle.definition"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"

type Props = Readonly<{ relations: ReadonlyArray<OrganizationRelation> }>

/** 指揮命令の全改訂から、参照APIと同じ優先順で実際に有効な期間を組み立てる。 */
export class CompanyReportingRelationTimelineValue {
  private readonly relations: ReadonlyArray<OrganizationRelation>

  private constructor(props: Props) {
    this.relations = Object.freeze(props.relations.map((relation) => Object.freeze(relation)))
    Object.freeze(this)
  }

  static create(
    history: ReadonlyArray<CompanyResourceEntity>,
  ): CompanyReportingRelationTimelineValue | CompanyResourceValidationError {
    const organizationId = history[0]?.organizationId
    if (
      history.some(
        (resource) =>
          resource.type !== "reporting-relation" || resource.organizationId !== organizationId,
      )
    )
      return new CompanyResourceValidationError("invalid_organization")
    const relations: OrganizationRelation[] = []
    for (const versions of this.groupHistory(history)) {
      for (const entry of versions.entries()) {
        const resource = entry[1]
        if (resource.state === "void") continue
        const relation = this.toRelation(resource, versions[entry[0] + 1])
        if (relation instanceof Error) return relation
        relations.push(relation)
      }
    }
    return new CompanyReportingRelationTimelineValue({ relations })
  }

  private static groupHistory(history: ReadonlyArray<CompanyResourceEntity>) {
    const histories = new Map<string, Map<string, CompanyResourceEntity>>()
    for (const resource of history) {
      const versions = histories.get(resource.id) ?? new Map<string, CompanyResourceEntity>()
      const previous = versions.get(resource.effectiveFrom)
      if (previous === undefined || previous.revision < resource.revision) {
        versions.set(resource.effectiveFrom, resource)
      }
      histories.set(resource.id, versions)
    }
    return [...histories.values()].map((versions) =>
      [...versions.values()].toSorted((left, right) =>
        left.effectiveFrom.localeCompare(right.effectiveFrom),
      ),
    )
  }

  private static toRelation(
    resource: CompanyResourceEntity,
    next: CompanyResourceEntity | undefined,
  ): OrganizationRelation | CompanyResourceValidationError {
    const employeeId = resource.readText("employeeId")
    const managerEmployeeId = resource.readText("managerEmployeeId")
    const organizationUnitId = resource.readText("organizationUnitId")
    if (employeeId === null || managerEmployeeId === null || organizationUnitId === null)
      return new CompanyResourceValidationError("invalid_organization")
    const endsOn =
      next === undefined ||
      (resource.effectiveTo !== null && resource.effectiveTo < next.effectiveFrom)
        ? resource.effectiveTo
        : next.effectiveFrom
    return {
      employeeId,
      managerEmployeeId,
      organizationUnitId,
      startsOn: resource.effectiveFrom,
      endsOn,
    }
  }

  readPeriods(): ReadonlyArray<OrganizationRelation> {
    return this.relations
  }

  hasManagementCycle(additional: ReadonlyArray<OrganizationRelation> = []): boolean {
    const relations = [...this.relations, ...additional]
    const boundaries = new Set(
      relations.flatMap((relation) =>
        relation.endsOn === null ? [relation.startsOn] : [relation.startsOn, relation.endsOn],
      ),
    )
    return [...boundaries].some((date) => this.hasCycleAt(date, relations))
  }

  private hasCycleAt(date: string, relations: ReadonlyArray<OrganizationRelation>): boolean {
    const managersByEmployee = new Map<string, string[]>()
    for (const relation of relations) {
      if (relation.startsOn <= date && (relation.endsOn === null || date < relation.endsOn)) {
        const managers = managersByEmployee.get(relation.employeeId) ?? []
        managers.push(relation.managerEmployeeId)
        managersByEmployee.set(relation.employeeId, managers)
      }
    }
    return hasManagementCycle(managersByEmployee)
  }
}
