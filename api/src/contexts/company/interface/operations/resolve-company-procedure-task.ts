import { ResolveCompanyProcedureTaskAdapter } from "@/contexts/company/infrastructure/adapters/organization/resolve-company-procedure-task.adapter"

/** 手続き規程の次の task と判断者を会社の資格から解決する公開境界。 */
export function resolveCompanyProcedureTask(
  c: ConstructorParameters<typeof ResolveCompanyProcedureTaskAdapter>[0],
  ...input: Parameters<ResolveCompanyProcedureTaskAdapter["resolveCompanyProcedureTask"]>
): ReturnType<ResolveCompanyProcedureTaskAdapter["resolveCompanyProcedureTask"]> {
  return new ResolveCompanyProcedureTaskAdapter(c).resolveCompanyProcedureTask(...input)
}
