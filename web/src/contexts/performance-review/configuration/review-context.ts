import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { SystemReadAuthentication } from "@system/domain/definitions/system-read-authentication.definition"

export type ReviewContext = CompanyContext &
  Readonly<{
    actor: Readonly<{
      accountId: AccountId
      employeeId: EmployeeId
      authentication: SystemReadAuthentication
    }>
    now: () => Date
  }>
export type ReviewCommand = Readonly<{
  idempotencyKey: string
  digest: string
  reason: string
  operation: string
  detail: unknown
}>
