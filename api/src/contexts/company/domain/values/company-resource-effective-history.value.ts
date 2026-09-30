import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"

type HistoricalResource = CompanyResourceProps & Readonly<{ correctsRevision?: number | null }>

/** 原履歴の版と期間を保全し、同じ発効日の訂正後の属性を検証する。 */
export class CompanyResourceEffectiveHistoryValue {
  private constructor(readonly resources: ReadonlyArray<CompanyResourceEntity>) {
    Object.freeze(this)
  }

  static create(
    history: ReadonlyArray<HistoricalResource>,
  ): CompanyResourceEffectiveHistoryValue | CompanyResourceValidationError {
    const revisions = new Map<string, number>()
    const effective = new Map<string, HistoricalResource>()
    const ordered = history.toSorted(
      (a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id) || a.revision - b.revision,
    )
    for (const resource of ordered) {
      const key = JSON.stringify([resource.organizationId, resource.type, resource.id])
      if (resource.revision !== (revisions.get(key) ?? 0) + 1)
        return new CompanyResourceValidationError("invalid_revision")
      revisions.set(key, resource.revision)
      effective.set(JSON.stringify([key, resource.effectiveFrom]), resource)
    }
    const correctedRevisions = new Set(
      ordered.flatMap((resource) =>
        resource.correctsRevision === undefined || resource.correctsRevision === null
          ? []
          : [
              JSON.stringify([
                resource.organizationId,
                resource.type,
                resource.id,
                resource.correctsRevision,
              ]),
            ],
      ),
    )
    const resources: CompanyResourceEntity[] = []
    for (const resource of effective.values()) {
      if (
        correctedRevisions.has(
          JSON.stringify([resource.organizationId, resource.type, resource.id, resource.revision]),
        ) ||
        (resource.state === "void" && resource.correctsRevision != null)
      )
        continue
      const entity = CompanyResourceEntity.create(resource)
      if (entity instanceof Error) return entity
      resources.push(entity)
    }
    for (const resource of ordered) {
      const replacement = effective.get(
        JSON.stringify([
          JSON.stringify([resource.organizationId, resource.type, resource.id]),
          resource.effectiveFrom,
        ]),
      )
      if (replacement === undefined) return new CompanyResourceValidationError("invalid_resource")
      const envelope = CompanyResourceEntity.create({
        ...resource,
        attributes: replacement.attributes,
      })
      if (envelope instanceof Error) return envelope
    }
    return new CompanyResourceEffectiveHistoryValue(Object.freeze(resources))
  }
}
