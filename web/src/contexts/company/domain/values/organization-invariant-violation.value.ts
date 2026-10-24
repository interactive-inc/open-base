import type { OrganizationInvariantCode } from "@/contexts/company/domain/definitions/organization-invariant.definition"

export class OrganizationInvariantViolationValue {
  constructor(
    readonly code: OrganizationInvariantCode,
    readonly message: string,
  ) {
    Object.freeze(this)
  }
}
