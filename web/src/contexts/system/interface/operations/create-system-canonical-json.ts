import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"

/** Systemが所有する値を検証・生成する。 */
export function createSystemCanonicalJson(
  ...input: Parameters<typeof CanonicalSystemJsonValue.create>
) {
  return CanonicalSystemJsonValue.create(...input)
}
