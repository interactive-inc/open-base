import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { PersonnelActionInput } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type DirectPersonnelActionCommand = Readonly<{
  session: CompanyPersonnelSession
  employeeId: EmployeeId
  input: PersonnelActionInput
  idempotencyKey: string
  expectedCompanyRevision?: number
  expectedEmployeeRevision: number
  expectedOrganizationRevision: number | null
}>
