import type { WorkforceInvariantCode } from "@/contexts/company/domain/definitions/workforce-invariant.definition"

export class WorkforceInvariantViolationValue {
  constructor(
    readonly code: WorkforceInvariantCode,
    readonly message: string,
  ) {
    Object.freeze(this)
  }
}
