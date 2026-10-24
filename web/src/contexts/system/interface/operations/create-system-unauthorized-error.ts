import { ApplicationUnauthorizedError } from "@system/application/errors"

export function createSystemUnauthorizedError(
  ...input: ConstructorParameters<typeof ApplicationUnauthorizedError>
) {
  return new ApplicationUnauthorizedError(...input)
}
