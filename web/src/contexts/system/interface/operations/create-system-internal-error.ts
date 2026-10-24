import { ApplicationInternalError } from "@system/application/errors"

export function createSystemInternalError(
  ...input: ConstructorParameters<typeof ApplicationInternalError>
) {
  return new ApplicationInternalError(...input)
}
