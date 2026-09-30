import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"

/** 定義管理の限定資格を別の資源種別への変更権限として使わない。 */
export function canWriteCompanyDefinitions(
  actor: CompanyActorValue,
  types: ReadonlyArray<CompanyResourceType>,
): boolean {
  if (actor.hasCapability("company:write")) return true
  if (types.length === 0) return false
  return types.every((type) => {
    if (type === "grade") return actor.hasPermission("master:grade:write")
    if (type === "position") return actor.hasPermission("master:position:write")
    return false
  })
}
