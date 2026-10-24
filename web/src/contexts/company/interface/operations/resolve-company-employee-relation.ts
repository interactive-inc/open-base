import { ResolveEmployeeRelationAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-employee-relation.adapter"

/** 2 人の従業員の組織上の関係を解決する公開境界。 */
export function resolveCompanyEmployeeRelation(
  c: ConstructorParameters<typeof ResolveEmployeeRelationAdapter>[0],
  ...input: Parameters<ResolveEmployeeRelationAdapter["resolveEmployeeRelation"]>
): ReturnType<ResolveEmployeeRelationAdapter["resolveEmployeeRelation"]> {
  return new ResolveEmployeeRelationAdapter(c).resolveEmployeeRelation(...input)
}
