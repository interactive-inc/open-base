import { ApplicationTooManyRequestsError } from "@system/application/errors"

export function createSystemTooManyRequestsError(
  ...input: ConstructorParameters<typeof ApplicationTooManyRequestsError>
) {
  return new ApplicationTooManyRequestsError(...input)
}
