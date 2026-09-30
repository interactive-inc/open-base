import { OIDCMetadataNotFoundError } from "@system/interface/errors"

export function createSystemOidcMetadataNotFoundError() {
  return new OIDCMetadataNotFoundError()
}
