import { RevalidateCompanyProcedureAuthorityAdapter } from "@/contexts/company/infrastructure/adapters/organization/revalidate-company-procedure-authority.adapter"

/** 手続きの判断資格を再検査する公開境界。 */
export function revalidateCompanyProcedureAuthority(
  c: ConstructorParameters<typeof RevalidateCompanyProcedureAuthorityAdapter>[0],
  ...input: Parameters<RevalidateCompanyProcedureAuthorityAdapter["revalidate"]>
): ReturnType<RevalidateCompanyProcedureAuthorityAdapter["revalidate"]> {
  return new RevalidateCompanyProcedureAuthorityAdapter(c).revalidate(...input)
}
