import { ApplicationUnprocessableEntityError } from "@system/application/errors"

export function createSystemUnprocessableEntityError(
  ...input: ConstructorParameters<typeof ApplicationUnprocessableEntityError>
) {
  return new ApplicationUnprocessableEntityError(...input)
}
