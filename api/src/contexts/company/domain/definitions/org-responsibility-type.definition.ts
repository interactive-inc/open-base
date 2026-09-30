declare const organizationResponsibilityTypeBrand: unique symbol

export type OrgResponsibilityType = string & {
  readonly [organizationResponsibilityTypeBrand]: true
}

const ORGANIZATION_RESPONSIBILITY_TYPE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/

export function isOrgResponsibilityType(value: string): value is OrgResponsibilityType {
  return ORGANIZATION_RESPONSIBILITY_TYPE_PATTERN.test(value)
}
