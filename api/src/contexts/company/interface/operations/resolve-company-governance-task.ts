import { ResolveCompanyGovernanceTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-governance-task.adapter"

/** ガバナンス上の task と判断者を会社の資格から解決する公開境界。 */
export function resolveCompanyGovernanceTask(
  c: ConstructorParameters<typeof ResolveCompanyGovernanceTaskAdapter>[0],
  ...input: Parameters<ResolveCompanyGovernanceTaskAdapter["resolve"]>
): ReturnType<ResolveCompanyGovernanceTaskAdapter["resolve"]> {
  return new ResolveCompanyGovernanceTaskAdapter(c).resolve(...input)
}
