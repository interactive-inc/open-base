import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import {
  EmployeeResourceAdoptionEntity,
  type EmployeeResourceAdoptionInput,
} from "@/contexts/company/domain/entities/employee-resource-adoption.entity"
import {
  EmployeeResourceAdoptionTerminationValue,
  type EmployeeResourceAdoptionTerminationInput,
} from "@/contexts/company/domain/values/employee-resource-adoption-termination.value"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceEffectiveHistoryValue } from "@/contexts/company/domain/values/company-resource-effective-history.value"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import type { EmployeeResourceAdoptionSnapshotValue } from "@/contexts/company/domain/values/employee-resource-adoption-snapshot.value"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"

type Context = Omit<EmployeeResourceAdoptionInput, "resources" | "reuseExistingHistory"> &
  Readonly<{ actorAccountId: string; recordedAt: number }>
export type EmployeeResourceAdoptionConfirmation = Readonly<{
  command: EmployeeResourceAdoptionEntity
  corrections: ReadonlyArray<CompanyResourceEntity>
  heads: ReadonlyArray<CompanyResourceProps>
  termination: EmployeeResourceAdoptionTerminationValue | null
}>

/** 確認済みの訂正を原履歴へ追記し、訂正後の全期間と台帳の一致を検査する。 */
export class EmployeeResourceAdoptionCorrectionValue {
  private constructor(readonly props: EmployeeResourceAdoptionConfirmation) {
    Object.freeze(this)
  }

  static create(
    snapshot: EmployeeResourceAdoptionSnapshotValue,
    input: Readonly<{
      context: Context
      corrections: ReadonlyArray<CompanyResourceProps>
      terminationBoundaryCorrection?: EmployeeResourceAdoptionTerminationInput
    }>,
  ): EmployeeResourceAdoptionCorrectionValue | Error {
    if (input.corrections.length < 1 || input.corrections.length > 20) return this.invalid()
    const source = snapshot.props.value.publicResources.map((resource) => ({
      organizationId: resource.organizationId,
      type: resource.type,
      id: resource.id,
      revision: resource.revision,
      state: resource.state,
      effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
      effectiveTo: resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
      attributes: resource.attributes,
    }))
    const heads = new Map<string, CompanyResourceProps>()
    for (const resource of source.toSorted((a, b) => a.revision - b.revision))
      heads.set(JSON.stringify([resource.type, resource.id]), resource)
    const canonical = (resources: ReadonlyArray<CompanyResourceProps>) =>
      CanonicalSystemJsonValue.create(
        resources.toSorted((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id)),
      )
    const expectedHeads = canonical([...heads.values()])
    const actualHeads = canonical(
      snapshot.props.value.publicHeads.map((resource) => ({
        ...resource,
        effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
        effectiveTo:
          resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
      })),
    )
    if (
      expectedHeads instanceof Error ||
      actualHeads instanceof Error ||
      expectedHeads.toString() !== actualHeads.toString()
    )
      return this.invalid()
    const corrections: CompanyResourceEntity[] = []
    for (const resource of input.corrections.toSorted((a, b) => a.revision - b.revision)) {
      const entity = CompanyResourceEntity.create(resource)
      const key = JSON.stringify([resource.type, resource.id])
      const previous = heads.get(key)
      if (
        entity instanceof Error ||
        previous === undefined ||
        entity.organizationId !== previous.organizationId ||
        entity.revision !== previous.revision + 1
      )
        return this.invalid()
      corrections.push(entity)
      heads.set(key, entity)
    }
    const history = [...source, ...corrections]
    if (history.length > 100) return this.invalid()
    const effective = CompanyResourceEffectiveHistoryValue.create(history)
    if (effective instanceof Error) return this.invalid()
    for (const employment of snapshot.props.value.employments) {
      const timeline = CompanyEmploymentResourceTimelineValue.create(
        history.filter(
          (resource) => resource.type === "employment" && resource.id === employment.id,
        ),
      )
      if (timeline instanceof Error) return this.invalid()
    }
    // 照合用の有効区間だけを既存の人物・雇用ポリシーへ渡す。この版列は保存しない。
    const revisions = new Map<string, number>()
    const resources = effective.resources
      .toSorted((a, b) => a.revision - b.revision)
      .map((resource) => {
        const key = JSON.stringify([resource.type, resource.id])
        const revision = (revisions.get(key) ?? 0) + 1
        revisions.set(key, revision)
        return { ...resource.toProps(), revision }
      })
    const command = EmployeeResourceAdoptionEntity.create({ ...input.context, resources })
    if (command instanceof Error) return command
    const identity = command.validateSnapshotIdentity(snapshot)
    if (identity !== null) return identity
    const termination =
      input.terminationBoundaryCorrection === undefined
        ? null
        : EmployeeResourceAdoptionTerminationValue.create(
            snapshot.props.value,
            input.terminationBoundaryCorrection,
          )
    if (termination instanceof Error) return termination
    const error = command.validateFacts(termination?.props.source ?? snapshot.props.value)
    if (error !== null) return error
    return new EmployeeResourceAdoptionCorrectionValue(
      Object.freeze({
        command,
        termination,
        corrections: Object.freeze(corrections),
        heads: Object.freeze([...heads.values()]),
      }),
    )
  }

  private static invalid() {
    return new CompanyValidationError(
      "訂正履歴と確認した台帳が一致しません",
      "invalid_employee_resource_adoption_correction",
    )
  }
}
