import { CompanyResourceValidationError } from "@/contexts/company/domain/errors"
import type { CalendarDate } from "@/contexts/company/domain/definitions/calendar-date.definition"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import {
  companyResourceTypes,
  type CompanyResourceType,
} from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import {
  organizationUnitKinds,
  type OrganizationUnitPeriod,
} from "@/contexts/company/domain/values/organization-structure.value"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { isCanonicalCompanyResourceAttributes } from "@/contexts/company/domain/definitions/is-canonical-company-resource-attributes.definition"

export type CompanyResourceState = "active" | "void"
export type CompanyJson =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<CompanyJson>
  | CompanyJsonObject
export type CompanyJsonObject = { readonly [key: string]: CompanyJson }

export type CompanyResourceProps = Readonly<{
  organizationId: string
  type: CompanyResourceType
  id: string
  revision: number
  state: CompanyResourceState
  effectiveFrom: CalendarDate
  effectiveTo: CalendarDate | null
  attributes: CompanyJsonObject
}>

export class CompanyResourceEntity {
  readonly organizationId: string
  readonly type: CompanyResourceType
  readonly id: string
  readonly revision: number
  readonly state: CompanyResourceState
  readonly effectiveFrom: CalendarDate
  readonly effectiveTo: CalendarDate | null
  readonly attributes: CompanyJsonObject

  private constructor(props: CompanyResourceProps) {
    this.organizationId = props.organizationId
    this.type = props.type
    this.id = props.id
    this.revision = props.revision
    this.state = props.state
    this.effectiveFrom = props.effectiveFrom
    this.effectiveTo = props.effectiveTo
    this.attributes = freezeCompanyJsonObject(props.attributes)
    Object.freeze(this)
  }

  static create(
    props: CompanyResourceProps,
  ): CompanyResourceEntity | CompanyResourceValidationError {
    if (!isCompanyIdentifier(props.organizationId) || !isCompanyIdentifier(props.id)) {
      return new CompanyResourceValidationError("invalid_identifier")
    }
    if (
      (props.type === "employee" || props.type === "employment") &&
      !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(props.id)
    )
      return new CompanyResourceValidationError("invalid_identifier")
    if (!Number.isSafeInteger(props.revision) || props.revision < 1) {
      return new CompanyResourceValidationError("invalid_revision")
    }
    if (
      !isCalendarDate(props.effectiveFrom) ||
      (props.effectiveTo !== null &&
        (!isCalendarDate(props.effectiveTo) || props.effectiveTo <= props.effectiveFrom))
    ) {
      return new CompanyResourceValidationError("invalid_period")
    }
    if (!isCompanyJson(props.attributes)) {
      return new CompanyResourceValidationError("invalid_attributes")
    }
    if (!isCanonicalCompanyResourceAttributes(props.type, props.attributes)) {
      return new CompanyResourceValidationError("invalid_resource")
    }

    return new CompanyResourceEntity(props)
  }

  static isType(value: string): value is CompanyResourceType {
    return companyResourceTypes.some((type) => type === value)
  }

  static isIdentifier(value: string): boolean {
    return isCompanyIdentifier(value)
  }

  toProps(): CompanyResourceProps {
    return Object.freeze({
      organizationId: this.organizationId,
      type: this.type,
      id: this.id,
      revision: this.revision,
      state: this.state,
      effectiveFrom: this.effectiveFrom,
      effectiveTo: this.effectiveTo,
      attributes: this.attributes,
    })
  }

  contains(date: CalendarDate): boolean {
    return this.effectiveFrom <= date && (this.effectiveTo === null || date < this.effectiveTo)
  }

  containsPeriod(other: CompanyResourceEntity): boolean {
    return (
      this.effectiveFrom <= other.effectiveFrom &&
      (this.effectiveTo === null ||
        (other.effectiveTo !== null && other.effectiveTo <= this.effectiveTo))
    )
  }

  overlaps(other: CompanyResourceEntity): boolean {
    return (
      (this.effectiveTo === null || other.effectiveFrom < this.effectiveTo) &&
      (other.effectiveTo === null || this.effectiveFrom < other.effectiveTo)
    )
  }

  readText(key: string): string | null {
    const value = this.attributes[key]
    return typeof value === "string" && value.length > 0 && value.trim() === value ? value : null
  }

  readNullableText(key: string): string | null | undefined {
    const value = this.attributes[key]
    if (value === null || value === undefined) return value
    return typeof value === "string" && value.length > 0 && value.trim() === value
      ? value
      : undefined
  }

  toOrganizationUnitPeriod(): OrganizationUnitPeriod | null {
    if (this.type !== "organization-unit") return null

    const organizationUnitId = this.readText("organizationUnitId")
    const code = this.readText("code")
    const officialName = this.readText("officialName")
    const kind = this.readText("kind")
    const parentOrganizationUnitId = this.readNullableText("parentOrganizationUnitId")
    if (
      organizationUnitId === null ||
      code === null ||
      officialName === null ||
      kind === null ||
      !organizationUnitKinds.includes(kind as (typeof organizationUnitKinds)[number]) ||
      parentOrganizationUnitId === undefined
    ) {
      return null
    }

    try {
      return Object.freeze({
        periodId: restoreWorkforceId("period", this.id),
        revision: this.revision,
        startsOn: this.effectiveFrom,
        endsOn: this.effectiveTo,
        isVoid: this.state === "void",
        recordedByActionId: restoreWorkforceId("personnel_action", COMPANY_RESOURCE_ACTION_ID),
        recordedAt: 0,
        organizationUnitId: restoreWorkforceId("organization_unit", organizationUnitId),
        code,
        officialName,
        kind: kind as OrganizationUnitPeriod["kind"],
        parentOrganizationUnitId:
          parentOrganizationUnitId === null
            ? null
            : restoreWorkforceId("organization_unit", parentOrganizationUnitId),
      })
    } catch {
      return null
    }
  }
}

/**
 * 公開履歴から組み立てた組織単位の期間は人事の発令を持たない。記録した操作の欄には、
 * どの発令とも重ならない決まった UUID を入れる。
 */
const COMPANY_RESOURCE_ACTION_ID = deterministicCompanyId("personnel-action", "company-resource")

function isCompanyIdentifier(value: string): boolean {
  return value.length >= 1 && value.length <= 255 && value.trim() === value && !/\s/.test(value)
}

function isCompanyJson(value: unknown, depth = 0): value is CompanyJson {
  if (depth > 20) return false
  if (value === null || typeof value === "boolean" || typeof value === "string") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) {
    return value.length <= 1_000 && value.every((item) => isCompanyJson(item, depth + 1))
  }
  if (typeof value !== "object") return false

  const entries = Object.entries(value)
  return (
    entries.length <= 1_000 &&
    entries.every(
      ([key, item]) => key.length >= 1 && key.length <= 255 && isCompanyJson(item, depth + 1),
    )
  )
}

function freezeCompanyJson(value: CompanyJson): CompanyJson {
  if (isCompanyJsonArray(value)) return Object.freeze(value.map(freezeCompanyJson))
  if (value !== null && typeof value === "object") return freezeCompanyJsonObject(value)
  return value
}

function isCompanyJsonArray(value: CompanyJson): value is ReadonlyArray<CompanyJson> {
  return Array.isArray(value)
}

function freezeCompanyJsonObject(value: CompanyJsonObject): CompanyJsonObject {
  return Object.freeze(
    Object.fromEntries(Object.entries(value).map(([key, item]) => [key, freezeCompanyJson(item)])),
  )
}
