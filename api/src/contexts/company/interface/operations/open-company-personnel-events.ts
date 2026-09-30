import { CompanyPersonnelEventRepository } from "@/contexts/company/infrastructure/repositories/employee-lifecycle/company-personnel-event.repository"

export type CompanyPersonnelEvents = Pick<
  CompanyPersonnelEventRepository,
  "findEmploymentEffect" | "prepareGuard"
>

/** 人事発令の雇用効果を読み、実行直前の一致を保護する公開境界。 */
export function openCompanyPersonnelEvents(
  c: ConstructorParameters<typeof CompanyPersonnelEventRepository>[0],
): CompanyPersonnelEvents {
  return new CompanyPersonnelEventRepository(c)
}
