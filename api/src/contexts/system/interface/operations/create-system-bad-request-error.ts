import { ApplicationBadRequestError } from "@system/application/errors"

export function createSystemBadRequestError(
  ...input: ConstructorParameters<typeof ApplicationBadRequestError>
) {
  return new ApplicationBadRequestError(...input)
}
