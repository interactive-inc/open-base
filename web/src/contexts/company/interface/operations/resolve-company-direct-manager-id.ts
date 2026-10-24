import { ResolveDirectManagerIdAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-direct-manager-id.adapter"

/** 従業員の直属の上長を解決する公開境界。 */
export function resolveCompanyDirectManagerId(
  c: ConstructorParameters<typeof ResolveDirectManagerIdAdapter>[0],
  ...input: Parameters<ResolveDirectManagerIdAdapter["resolveDirectManagerId"]>
): ReturnType<ResolveDirectManagerIdAdapter["resolveDirectManagerId"]> {
  return new ResolveDirectManagerIdAdapter(c).resolveDirectManagerId(...input)
}
