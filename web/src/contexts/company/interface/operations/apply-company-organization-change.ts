import { ApplyOrganizationChange } from "@/contexts/company/application/organization/apply-organization-change"

/** 組織の版付き変更を会社の不変条件で検査して適用する公開境界。 */
export function applyCompanyOrganizationChange(
  c: ConstructorParameters<typeof ApplyOrganizationChange>[0],
  ...input: Parameters<ApplyOrganizationChange["execute"]>
): ReturnType<ApplyOrganizationChange["execute"]> {
  return new ApplyOrganizationChange(c).execute(...input)
}
