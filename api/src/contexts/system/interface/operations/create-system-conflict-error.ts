import { ApplicationConflictError } from "@system/application/errors"

export function createSystemConflictError(
  ...input: ConstructorParameters<typeof ApplicationConflictError>
) {
  return new ApplicationConflictError(...input)
}
