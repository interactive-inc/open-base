import { SystemAuditJsonError } from "@system/domain/errors"

export function createSystemAuditEncodingError() {
  return new SystemAuditJsonError("invalid_json")
}
