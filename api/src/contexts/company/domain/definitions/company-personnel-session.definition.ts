import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type CompanyPersonnelSession = Readonly<{
  accountId: AccountId
  employeeId: EmployeeId
  hasPermission(permission: string): boolean
}>
