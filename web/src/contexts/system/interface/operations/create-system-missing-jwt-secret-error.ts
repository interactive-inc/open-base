import { JwtSecretMissingApplicationError } from "@system/application/errors"

export function createSystemMissingJwtSecretError(
  ...input: ConstructorParameters<typeof JwtSecretMissingApplicationError>
) {
  return new JwtSecretMissingApplicationError(...input)
}
