import { listCompanyPersonnelActionRequests } from "@/contexts/company/interface/operations/list-company-personnel-action-requests"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import type {
  PersonnelActionRequestRecord,
  PersonnelActionRequestStatus,
} from "@/contexts/company/domain/definitions/personnel-action-request-record.definition"
import { personnelActionInputSchema } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { Context } from "@/env"
import type { CompanySessionValue } from "@/contexts/company/domain/values/company-session.value"
import { UnexpectedError } from "@/lib/errors"
import { readSystemWorkflowReferences } from "@system/interface/operations/read-system-workflow-references"

type Filters = Readonly<{
  targetEmployeeCode?: string
  status?: PersonnelActionRequestStatus
  limit: number
}>

/** Company申請とSystemの判断状態を、現在の参加者scopeで一覧へ合成する。 */
export class ListPersonnelActionRequests {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async execute(
    session: CompanySessionValue,
    filters: Filters,
  ): Promise<ReadonlyArray<PersonnelActionRequestRecord> | UnexpectedError> {
    try {
      const rows = await listCompanyPersonnelActionRequests(this.c.env.DB)
      if (rows instanceof Error) {
        return new UnexpectedError("人事変更申請の一覧を取得できません", { cause: rows })
      }
      const workflows = await readSystemWorkflowReferences(
        {
          env: { DB: this.c.env.DB },
        },
        {
          numbers: rows.map((row) => row.application_id),
          actorAccountId: session.accountId,
          includeAll: session.hasPermission("employee:lifecycle:read:all"),
          at: new Date(this.c.env.NOW ?? Date.now()),
        },
      )
      if (workflows instanceof Error) {
        return new UnexpectedError("人事変更申請の一覧を取得できません", { cause: workflows })
      }
      const workflowByNumber = new Map(workflows.map((workflow) => [workflow.number, workflow]))
      const visibleRows = rows.filter((row) => workflowByNumber.has(row.application_id))
      const employees = await openCompanyEmployeeDirectory({
        env: this.c.env,
      }).findForEmployeeIds(
        visibleRows.flatMap((row) =>
          row.target_employee_id === null
            ? [row.requested_by_employee_id]
            : [row.target_employee_id, row.requested_by_employee_id],
        ),
      )
      if (employees instanceof Error)
        return new UnexpectedError("人事変更申請の人物情報を取得できません", { cause: employees })
      const employeeById = new Map(employees.map((employee) => [employee.id, employee]))
      const requests: PersonnelActionRequestRecord[] = []
      for (const row of visibleRows) {
        const workflow = workflowByNumber.get(row.application_id)
        if (workflow === undefined) continue
        const target =
          row.target_employee_id === null ? null : employeeById.get(row.target_employee_id)
        const requester = employeeById.get(row.requested_by_employee_id)
        const targetCode =
          row.target_employee_id === null ? row.target_employee_code : target?.employeeCode
        const targetName =
          row.target_employee_id === null ? row.target_employee_name : target?.officialName
        if (targetCode == null || targetName == null || requester?.employeeCode == null)
          return new UnexpectedError("人事変更申請の人物情報を取得できません")
        if (filters.targetEmployeeCode !== undefined && targetCode !== filters.targetEmployeeCode)
          continue
        const action = personnelActionInputSchema.safeParse(JSON.parse(row.payload_json))
        if (
          !action.success ||
          row.system_proposal_series_id === null ||
          row.system_proposal_series_id !== workflow.seriesId ||
          row.payload_fingerprint === null ||
          row.base_employee_revision === null
        ) {
          return new UnexpectedError("人事変更申請の保存データが不正です")
        }
        const status: PersonnelActionRequestStatus =
          row.withdrawn_at !== null
            ? "withdrawn"
            : workflow.status === "pending"
              ? "pending"
              : workflow.status === "approved" || workflow.status === "executed"
                ? "approved"
                : "rejected"
        if (filters.status !== undefined && filters.status !== status) continue
        requests.push({
          id: row.id,
          applicationId: row.application_id,
          systemProposalSeriesId: row.system_proposal_series_id,
          systemCaseId: workflow.caseId,
          proposalDigest: workflow.proposalDigest,
          targetEmployeeId: row.target_employee_id,
          targetEmployeeCode: targetCode,
          targetEmployeeName: targetName,
          targetDepartmentCode: row.target_department_code,
          kind: row.kind,
          action: action.data,
          payloadFingerprint: row.payload_fingerprint,
          requestedByEmployeeId: row.requested_by_employee_id,
          requestedByEmployeeCode: requester.employeeCode,
          requestedByEmployeeName: requester.officialName,
          baseEmployeeRevision: row.base_employee_revision,
          baseOrganizationRevision: row.base_organization_revision,
          baseCompanyRevision: row.base_company_revision,
          status,
          currentStep: workflow.currentTaskKey,
          createdAt: row.created_at,
          appliedActionId: row.applied_action_id,
          withdrawnAt: row.withdrawn_at,
        })
        if (requests.length === filters.limit) break
      }
      return requests
    } catch (cause) {
      return new UnexpectedError("人事変更申請の一覧を取得できません", { cause })
    }
  }
}
