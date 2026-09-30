import type { WorkflowApproverSelector } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

export type WorkflowAccount = Readonly<{
  employeeId: EmployeeId
  accountId: AccountId
}>

export type WorkflowApproverProvenance = Readonly<{
  selector_index: number
  selector: WorkflowApproverSelector
  evidence: Readonly<Record<string, unknown>>
}>

export type WorkflowApproverMatch = Readonly<{
  employeeId: EmployeeId
  accountId: AccountId
  provenance: WorkflowApproverProvenance
}>
