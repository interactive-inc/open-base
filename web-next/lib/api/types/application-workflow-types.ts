import type { companyOrganizationId } from "@/lib/api/company-organization-id"

export type WorkflowApproverSelector =
  | { type: "role"; role_key: string }
  | { type: "employee"; employee_code: string }
  | { type: "direct_manager" }
  | { type: "department_manager" }
  | { type: "target_department_manager" }
  | {
      type: "responsibility"
      responsibility_type: string
      organization_unit_code: string | null
    }
  | { type: "management_chain" }

export type WorkflowCondition = {
  source: "payload" | "applicant"
  field: string
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "exists"
  value?: unknown
}

export type ApplicationWorkflowStep = {
  key: string
  name: string
  governance_authority?: {
    organization_id: typeof companyOrganizationId
    responsibility_code: string
    scope:
      | null
      | {
          scope_type: "organization-unit" | "legal-entity" | "site" | "workplace"
          scope_id: string
        }
      | { scope_type: "region"; region_code: string }
      | { scope_type: "amount"; currency_code: string; amount_field: string }
  }
  approvers: Array<WorkflowApproverSelector>
  approval_mode: "any" | "all" | "minimum"
  minimum_approvals?: number
  condition_mode: "all" | "any"
  conditions: Array<WorkflowCondition>
  due_days: number | null
  escalation_approvers: Array<WorkflowApproverSelector>
  rejection_behavior: "reject" | "return"
  allow_delegation: boolean
}

export type ApplicationWorkflow = { version: 1; steps: Array<ApplicationWorkflowStep> }
