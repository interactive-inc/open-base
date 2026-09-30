import { OrganizationChangeValidationError } from "@/contexts/company/domain/errors"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/values/organization-structure.value"
import type {
  OrgAssignmentPeriod,
  OrgResponsibilityPeriod,
} from "@/contexts/company/domain/entities/workforce-schedule.entity"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import type {
  OrganizationUnitId,
  PersonnelActionId,
} from "@/contexts/company/domain/definitions/workforce-id.definition"

export type OrganizationUnitIdentity = Readonly<{
  id: OrganizationUnitId
  createdAt: number
}>

export type OrganizationChangeEvidenceReference = Readonly<{
  context: string
  kind: string
  id: string
  version: string
}>

export type OrganizationWorkforceChangeProps = Readonly<{
  operationId: PersonnelActionId
  /** trigger が操作を見つけるための鍵。ID は companyOperationId(operationKey) になる */
  operationKey?: string | null
  expectedRevision: number
  asOf: CalendarDate
  recordedAt: number
  actorAccountId: string
  reason: string
  evidenceReferences: ReadonlyArray<OrganizationChangeEvidenceReference>
  organizationUnits: ReadonlyArray<OrganizationUnitIdentity>
  unitPeriods: ReadonlyArray<OrganizationUnitPeriod>
  assignments: ReadonlyArray<OrgAssignmentPeriod>
  responsibilities: ReadonlyArray<OrgResponsibilityPeriod>
}>

function isCanonicalText(value: string, maximumLength: number): boolean {
  return value.length >= 1 && value.length <= maximumLength && value.trim() === value
}

function freezeRecords<TValue extends object>(
  values: ReadonlyArray<TValue>,
): ReadonlyArray<Readonly<TValue>> {
  return Object.freeze(values.map((value) => Object.freeze({ ...value })))
}

/** 一つの人事操作で追記する組織・配属・責任periodを所有するEntity。 */
export class OrganizationWorkforceChangeEntity {
  readonly operationId: PersonnelActionId
  readonly operationKey: string | null
  readonly expectedRevision: number
  readonly asOf: CalendarDate
  readonly recordedAt: number
  readonly actorAccountId: string
  readonly reason: string
  readonly evidenceReferences: ReadonlyArray<OrganizationChangeEvidenceReference>
  readonly organizationUnits: ReadonlyArray<OrganizationUnitIdentity>
  readonly unitPeriods: ReadonlyArray<OrganizationUnitPeriod>
  readonly assignments: ReadonlyArray<OrgAssignmentPeriod>
  readonly responsibilities: ReadonlyArray<OrgResponsibilityPeriod>

  private constructor(props: OrganizationWorkforceChangeProps) {
    this.operationId = props.operationId
    this.operationKey = props.operationKey ?? null
    this.expectedRevision = props.expectedRevision
    this.asOf = props.asOf
    this.recordedAt = props.recordedAt
    this.actorAccountId = props.actorAccountId
    this.reason = props.reason
    this.evidenceReferences = freezeRecords(props.evidenceReferences)
    this.organizationUnits = freezeRecords(props.organizationUnits)
    this.unitPeriods = freezeRecords(props.unitPeriods)
    this.assignments = freezeRecords(props.assignments)
    this.responsibilities = freezeRecords(props.responsibilities)
    Object.freeze(this)
  }

  static restore(
    props: OrganizationWorkforceChangeProps,
  ): OrganizationWorkforceChangeEntity | OrganizationChangeValidationError {
    const periods = [...props.unitPeriods, ...props.assignments, ...props.responsibilities]
    if (periods.length === 0) return new OrganizationChangeValidationError("empty_change")
    if (
      !Number.isSafeInteger(props.expectedRevision) ||
      props.expectedRevision < 0 ||
      !Number.isSafeInteger(props.recordedAt) ||
      props.recordedAt < 0 ||
      periods.some(
        (period) =>
          period.recordedByActionId !== props.operationId || period.recordedAt !== props.recordedAt,
      )
    ) {
      return new OrganizationChangeValidationError("invalid_operation")
    }
    if (
      !isCanonicalText(props.actorAccountId, 255) ||
      !isCanonicalText(props.reason, 1_000) ||
      props.evidenceReferences.length > 100 ||
      props.evidenceReferences.some(
        (reference) =>
          !isCanonicalText(reference.context, 100) ||
          !isCanonicalText(reference.kind, 100) ||
          !isCanonicalText(reference.id, 512) ||
          !isCanonicalText(reference.version, 255),
      )
    ) {
      return new OrganizationChangeValidationError("invalid_audit")
    }
    if (
      new Set(props.organizationUnits.map((identity) => identity.id)).size !==
        props.organizationUnits.length ||
      props.organizationUnits.some(
        (identity) => !Number.isSafeInteger(identity.createdAt) || identity.createdAt < 0,
      )
    ) {
      return new OrganizationChangeValidationError("invalid_identity")
    }

    return new OrganizationWorkforceChangeEntity(props)
  }

  get periodCount(): number {
    return this.unitPeriods.length + this.assignments.length + this.responsibilities.length
  }
}
