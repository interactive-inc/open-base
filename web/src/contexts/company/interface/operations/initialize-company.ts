import { InitializeCompany } from "@/contexts/company/application/organization/initialize-company"
import { CompanyBootstrapRepository } from "@/contexts/company/infrastructure/repositories/organization/company-bootstrap.repository"

/** 最初の会社と既定の組織を、呼び出し側の確定条件と同じ transaction で作る公開境界。 */
export function initializeCompany(
  c: Omit<ConstructorParameters<typeof InitializeCompany>[0], "repository"> &
    Readonly<{ bootstrap: ConstructorParameters<typeof CompanyBootstrapRepository>[0] }>,
  ...input: Parameters<InitializeCompany["execute"]>
): ReturnType<InitializeCompany["execute"]> {
  const { bootstrap, ...context } = c
  return new InitializeCompany({
    ...context,
    repository: new CompanyBootstrapRepository(bootstrap),
  }).execute(...input)
}
