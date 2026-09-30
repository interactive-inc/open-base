import { CompanyEmploymentMovementsRepository } from "@/contexts/company/infrastructure/repositories/employee-lifecycle/company-employment-movements.repository"

/** 期間内の入退社の動きを読む公開境界。 */
export function readCompanyEmploymentMovements(
  c: ConstructorParameters<typeof CompanyEmploymentMovementsRepository>[0],
  ...input: Parameters<CompanyEmploymentMovementsRepository["find"]>
): ReturnType<CompanyEmploymentMovementsRepository["find"]> {
  return new CompanyEmploymentMovementsRepository(c).find(...input)
}
