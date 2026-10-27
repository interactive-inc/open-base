import type { CompanyPermissionKey } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import type { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"

/**
 * 定義の資源種別ごとに要求するCompany権限。いずれか一つを持てば書き込める。
 * 組織の定義は組織かマスタの編集、等級と役職はそれぞれのマスタの編集で開く。
 * 写像の無い種別は定義として扱わず拒否する。
 */
const definitionPermissions: Readonly<
  Partial<Record<CompanyResourceType, ReadonlyArray<CompanyPermissionKey>>>
> = Object.freeze({
  site: ["org:write", "master:org:write"],
  workplace: ["org:write", "master:org:write"],
  job: ["org:write", "master:org:write"],
  "organizational-office": ["org:write", "master:org:write"],
  responsibility: ["org:write", "master:org:write"],
  "authority-scope": ["org:write", "master:org:write"],
  "collective-body": ["org:write", "master:org:write"],
  grade: ["master:grade:write"],
  position: ["master:position:write"],
})

/**
 * 書き込むすべての定義の種別について、その種別の権限を要求する。
 * 会社全体の変更資格（company:write）だけでは通さない。従業員の編集から導かれる資格で
 * 組織の定義を書き換えられないようにする。種別が空、または写像の無い種別を含む場合は拒否する。
 */
export function canWriteCompanyDefinitions(
  actor: CompanyActorValue,
  types: ReadonlyArray<CompanyResourceType>,
): boolean {
  if (types.length === 0) return false
  return types.every((type) => {
    const permissions = definitionPermissions[type]
    if (permissions === undefined) return false
    return permissions.some((permission) => actor.hasPermission(permission))
  })
}
