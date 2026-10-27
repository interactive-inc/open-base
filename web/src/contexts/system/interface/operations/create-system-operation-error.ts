import { ApplicationError } from "@system/application/errors"

export function createSystemOperationError(
  ...input: ConstructorParameters<typeof ApplicationError>
) {
  return new ApplicationError(...input)
}
