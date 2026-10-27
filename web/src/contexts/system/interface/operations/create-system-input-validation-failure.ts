import { type AppValidationIssue } from "@system/interface/models/validation-error"

export function createSystemInputValidationFailure(
  message: string,
  issues: ReadonlyArray<AppValidationIssue>,
) {
  return { error: "invalid_input" as const, message, issues }
}
