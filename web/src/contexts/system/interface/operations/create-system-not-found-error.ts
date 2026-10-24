import { ApplicationNotFoundError } from "@system/application/errors"

export function createSystemNotFoundError(
  ...input: ConstructorParameters<typeof ApplicationNotFoundError>
) {
  return new ApplicationNotFoundError(...input)
}
