import { ResolveDepartmentManagerIdAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-department-manager-id.adapter"

/** 部署の責任者を解決する公開境界。 */
export function resolveCompanyDepartmentManagerId(
  c: ConstructorParameters<typeof ResolveDepartmentManagerIdAdapter>[0],
  ...input: Parameters<ResolveDepartmentManagerIdAdapter["resolveDepartmentManagerId"]>
): ReturnType<ResolveDepartmentManagerIdAdapter["resolveDepartmentManagerId"]> {
  return new ResolveDepartmentManagerIdAdapter(c).resolveDepartmentManagerId(...input)
}
