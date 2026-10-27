import { StableSystemAuditJsonValue } from "@system/domain/values/audit/stable-system-audit-json.value"

export function createSystemAuditJson(
  ...input: Parameters<typeof StableSystemAuditJsonValue.create>
) {
  return StableSystemAuditJsonValue.create(...input)
}
