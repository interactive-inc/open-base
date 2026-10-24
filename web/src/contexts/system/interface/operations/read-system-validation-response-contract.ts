import {
  zAppValidationIssue,
  zAppDefaultZodValidationError,
  zAppStructuredValidationError,
} from "@system/interface/models/validation-error"

export function readSystemValidationResponseContract() {
  return {
    issue: zAppValidationIssue,
    defaultError: zAppDefaultZodValidationError,
    structuredError: zAppStructuredValidationError,
  }
}
