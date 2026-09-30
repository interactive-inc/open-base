import { SystemHTTPException, SystemAuditDisclosureHttpError } from "@system/interface/errors"

export function createSystemAuditDisclosureHttpError(
  input: ConstructorParameters<typeof SystemHTTPException>[0],
) {
  return new SystemAuditDisclosureHttpError(input)
}
