import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"
import type { SystemAuditJsonValue } from "@system/domain/definitions/audit/system-audit-json-value.definition"

export function serializeSystemAuditMetadata(
  input: Readonly<Record<string, SystemAuditJsonValue>> | null,
) {
  return StableSystemAuditJsonValue.create(input)
}
