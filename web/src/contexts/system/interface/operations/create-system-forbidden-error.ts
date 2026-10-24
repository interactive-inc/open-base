import { ApplicationForbiddenError } from "@system/application/errors"

export function createSystemForbiddenError(
  ...input: ConstructorParameters<typeof ApplicationForbiddenError>
) {
  return new ApplicationForbiddenError(...input)
}
