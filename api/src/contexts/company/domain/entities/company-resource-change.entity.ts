import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import type { OrganizationChangeEvidenceReference } from "@/contexts/company/domain/entities/organization-workforce-change.entity"

export type CompanyResourceCorrection = Readonly<{
  type: CompanyResourceProps["type"]
  id: string
  revision: number
  correctsRevision: number
}>

export type CompanyResourceChangeProps = Readonly<{
  commandId: string
  expectedRevision: number
  actorAccountId: string
  reason: string
  recordedAt: number
  evidenceReferences?: ReadonlyArray<OrganizationChangeEvidenceReference>
  corrections?: ReadonlyArray<CompanyResourceCorrection>
  resources: ReadonlyArray<CompanyResourceProps>
}>

export class CompanyResourceChangeEntity {
  readonly commandId: string
  readonly expectedRevision: number
  readonly actorAccountId: string
  readonly reason: string
  readonly recordedAt: number
  readonly evidenceReferences: ReadonlyArray<OrganizationChangeEvidenceReference>
  readonly corrections: ReadonlyArray<CompanyResourceCorrection>
  readonly resources: ReadonlyArray<CompanyResourceEntity>

  private constructor(
    props: Omit<CompanyResourceChangeProps, "resources"> &
      Readonly<{ resources: ReadonlyArray<CompanyResourceEntity> }>,
  ) {
    this.commandId = props.commandId
    this.expectedRevision = props.expectedRevision
    this.actorAccountId = props.actorAccountId
    this.reason = props.reason
    this.recordedAt = props.recordedAt
    this.evidenceReferences = Object.freeze(
      (props.evidenceReferences ?? []).map((reference) => Object.freeze({ ...reference })),
    )
    this.corrections = Object.freeze(
      (props.corrections ?? []).map((correction) => Object.freeze({ ...correction })),
    )
    this.resources = Object.freeze([...props.resources])
    Object.freeze(this)
  }

  static create(
    props: CompanyResourceChangeProps,
  ): CompanyResourceChangeEntity | CompanyResourceValidationError {
    return CompanyResourceChangeEntity.validate(props, false)
  }

  /** 一つの確定事実が持つ連続した資源版を、同じ会社版へ保存する。 */
  static createHistoryBatch(
    props: CompanyResourceChangeProps,
  ): CompanyResourceChangeEntity | CompanyResourceValidationError {
    return CompanyResourceChangeEntity.validate(props, true)
  }

  private static validate(
    props: CompanyResourceChangeProps,
    historyBatch: boolean,
  ): CompanyResourceChangeEntity | CompanyResourceValidationError {
    if (
      !isCompanyIdentifier(props.commandId) ||
      !isCompanyIdentifier(props.actorAccountId) ||
      !Number.isSafeInteger(props.expectedRevision) ||
      props.expectedRevision < 0 ||
      !Number.isSafeInteger(props.recordedAt) ||
      props.recordedAt < 0 ||
      props.reason.length < 1 ||
      props.reason.length > 2_000 ||
      props.reason.trim() !== props.reason ||
      (props.evidenceReferences?.length ?? 0) > 100 ||
      props.evidenceReferences?.some((reference) =>
        ([reference.context, reference.kind, reference.id, reference.version] as const).some(
          (value, index) =>
            typeof value !== "string" ||
            value.length < 1 ||
            value.length > [100, 100, 512, 255][index]! ||
            value.trim() !== value,
        ),
      ) ||
      (props.corrections?.length ?? 0) > props.resources.length ||
      ((props.corrections?.length ?? 0) > 0 && (props.evidenceReferences?.length ?? 0) === 0) ||
      props.resources.length < 1 ||
      (!historyBatch && props.resources.length > 100)
    ) {
      return new CompanyResourceValidationError("invalid_change")
    }

    const resources: CompanyResourceEntity[] = []
    for (const resourceProps of props.resources) {
      const resource = CompanyResourceEntity.create(resourceProps)
      if (resource instanceof CompanyResourceValidationError) return resource
      resources.push(resource)
    }

    const organizationId = resources[0]?.organizationId
    const identities = new Map<string, number>()
    for (const resource of resources) {
      if (resource.organizationId !== organizationId) {
        return new CompanyResourceValidationError("invalid_change")
      }
      const identity = `${resource.type}\u0000${resource.id}`
      const previousRevision = identities.get(identity)
      if (
        previousRevision !== undefined &&
        (!historyBatch || resource.revision !== previousRevision + 1)
      )
        return new CompanyResourceValidationError("invalid_change")
      identities.set(identity, resource.revision)
    }

    const corrections = new Set<string>()
    for (const correction of props.corrections ?? []) {
      const target = resources.find(
        (resource) =>
          resource.type === correction.type &&
          resource.id === correction.id &&
          resource.revision === correction.revision,
      )
      const key = `${correction.type}\u0000${correction.id}\u0000${correction.revision}`
      if (
        target === undefined ||
        corrections.has(key) ||
        !Number.isSafeInteger(correction.correctsRevision) ||
        correction.correctsRevision < 1 ||
        correction.correctsRevision >= correction.revision
      ) {
        return new CompanyResourceValidationError("invalid_change")
      }
      corrections.add(key)
    }

    return new CompanyResourceChangeEntity({ ...props, resources })
  }
}

function isCompanyIdentifier(value: string): boolean {
  return value.length >= 1 && value.length <= 255 && value.trim() === value && !/\s/.test(value)
}
