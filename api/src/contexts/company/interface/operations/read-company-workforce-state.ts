import { EmployeeLifecycleWorkforceAdapter } from "@/contexts/company/infrastructure/adapters/workforce/employee-lifecycle-workforce.adapter"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { ReadWorkforceState } from "@/contexts/company/lib/workforce/read-workforce-state"

/** 従業員の在籍と所属を、指定日の会社の正本から読む公開境界。 */
export function readCompanyWorkforceState(
  c: Readonly<{
    workforce: ConstructorParameters<typeof EmployeeLifecycleWorkforceAdapter>[0]
    organization: ConstructorParameters<typeof OrganizationUnitReadAdapter>[0]
  }>,
  ...input: Parameters<ReadWorkforceState["execute"]>
): ReturnType<ReadWorkforceState["execute"]> {
  return new ReadWorkforceState({
    workforce: new EmployeeLifecycleWorkforceAdapter(c.workforce),
    organization: new OrganizationUnitReadAdapter(c.organization),
  }).execute(...input)
}
