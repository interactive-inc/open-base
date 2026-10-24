import { ResolveLiveEmployeeAccessAdapter } from "@/contexts/company/infrastructure/adapters/employee/resolve-live-employee-access.adapter"

/** 在籍中の従業員の利用可否を解決する公開境界。 */
export function resolveCompanyLiveEmployeeAccess(
  c: ConstructorParameters<typeof ResolveLiveEmployeeAccessAdapter>[0],
  ...input: Parameters<ResolveLiveEmployeeAccessAdapter["resolveLiveEmployeeAccess"]>
): ReturnType<ResolveLiveEmployeeAccessAdapter["resolveLiveEmployeeAccess"]> {
  return new ResolveLiveEmployeeAccessAdapter(c).resolveLiveEmployeeAccess(...input)
}
