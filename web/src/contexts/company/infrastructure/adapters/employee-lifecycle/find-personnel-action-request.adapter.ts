import { companyEmployeeProfileSql } from "@/contexts/company/infrastructure/adapters/employee/lib/company-employee-profile-sql"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import type { PersonnelActionRequestRecord } from "@/contexts/company/domain/definitions/personnel-action-request-record.definition"
import { personnelActionInputSchema } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import type { CompanyPersonnelSession } from "@/contexts/company/domain/definitions/company-personnel-session.definition"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import {
  CompanyUnexpectedError,
  CompanyConflictError,
  CompanyOperationError,
} from "@/contexts/company/domain/errors"
import { ReadSystemWorkflowReferencesAdapter } from "@system/infrastructure/adapters/workflow/read-system-workflow-references.adapter"
import { z } from "zod"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"

/** Company申請1件とSystem判断状態を、認可済みの表示recordへ合成する。 */
async function findPersonnelActionRequest(
  context: CompanyContext,
  session: CompanyPersonnelSession,
  selector: Readonly<{ id: string } | { applicationId: number }>,
): Promise<PersonnelActionRequestRecord | null | CompanyOperationError> {
  try {
    const byId = "id" in selector
    // 対象者と申請者の従業員 code と氏名は、会社営業日の正本から読む。
    const effectiveOn = resolveCompanyBusinessDate({
      now: context.env.NOW ?? new Date().toISOString(),
      timeZone: context.env.COMPANY_TIME_ZONE,
    })
    if (effectiveOn instanceof Error)
      return new CompanyUnexpectedError("人事変更申請を取得できません", { cause: effectiveOn })
    const row = await context.env.DB.prepare(
      `${companyEmployeeProfileSql()}
       SELECT request.id, request.application_id, request.system_proposal_series_id,
              request.target_employee_id, request.target_department_code,
              COALESCE(target.employee_code, json_extract(request.subject_snapshot_json, '$.employeeCode'))
                AS target_employee_code,
              COALESCE(target.official_name, json_extract(request.subject_snapshot_json, '$.employeeName'))
                AS target_employee_name,
              request.kind, request.payload_json, request.payload_fingerprint,
              request.requested_by_employee_id,
              requester.employee_code AS requested_by_employee_code,
              requester.official_name AS requested_by_employee_name,
              request.base_employee_revision, request.base_organization_revision, request.base_company_revision,
              request.created_at, request.applied_action_id, request.withdrawn_at
       FROM company_personnel_action_requests AS request
       LEFT JOIN employee_profiles AS target ON target.id = request.target_employee_id
       JOIN employee_profiles AS requester ON requester.id = request.requested_by_employee_id
       WHERE ${byId ? "request.id" : "request.application_id"} = ?2`,
    )
      .bind(effectiveOn, byId ? selector.id : selector.applicationId)
      .first<{
        id: string
        application_id: number
        system_proposal_series_id: string | null
        target_employee_id: EmployeeId | null
        target_department_code: string | null
        target_employee_code: string | null
        target_employee_name: string | null
        kind: string
        payload_json: string
        payload_fingerprint: string | null
        requested_by_employee_id: EmployeeId
        requested_by_employee_code: string
        requested_by_employee_name: string | null
        base_employee_revision: number | null
        base_organization_revision: number | null
        base_company_revision: number | null
        created_at: number
        applied_action_id: string | null
        withdrawn_at: number | null
      }>()
    if (row === null) return null
    if (row.requested_by_employee_name === null)
      return new CompanyUnexpectedError("人事変更申請の申請者を解決できません")

    const workflows = await new ReadSystemWorkflowReferencesAdapter({
      env: { DB: context.env.DB },
    }).readSystemWorkflowReferences({
      numbers: [row.application_id],
      actorAccountId: session.accountId,
      includeAll: session.hasPermission("employee:lifecycle:read:all"),
      at: new Date(context.env.NOW ?? Date.now()),
    })
    if (workflows instanceof Error) {
      return new CompanyUnexpectedError("人事変更申請を取得できません", { cause: workflows })
    }
    const workflow = workflows.at(0)
    if (workflow === undefined) return null

    const payload: unknown = JSON.parse(row.payload_json)
    const missingContract = z.object({
      kind: z.enum(["hire", "rehire"]),
      employmentType: z.undefined().optional(),
    })
    if (
      z
        .union([
          missingContract,
          z.object({ kind: z.literal("corrected"), replacementAction: missingContract }),
        ])
        .safeParse(payload).success
    ) {
      return new CompanyConflictError(
        "雇用区分のない申請は実行できません。区分を確認して新しく申請してください",
        "personnel_action_contract_required",
      )
    }
    const action = personnelActionInputSchema.safeParse(payload)
    if (
      !action.success ||
      row.system_proposal_series_id === null ||
      row.system_proposal_series_id !== workflow.seriesId ||
      row.payload_fingerprint === null ||
      row.target_employee_code === null ||
      row.target_employee_name === null ||
      row.base_employee_revision === null
    ) {
      return new CompanyUnexpectedError("人事変更申請の保存データが不正です")
    }

    return {
      id: row.id,
      applicationId: row.application_id,
      systemProposalSeriesId: row.system_proposal_series_id,
      systemCaseId: workflow.caseId,
      proposalDigest: workflow.proposalDigest,
      targetEmployeeId: row.target_employee_id,
      targetEmployeeCode: row.target_employee_code,
      targetEmployeeName: row.target_employee_name,
      targetDepartmentCode: row.target_department_code,
      kind: row.kind,
      action: action.data,
      payloadFingerprint: row.payload_fingerprint,
      requestedByEmployeeId: row.requested_by_employee_id,
      requestedByEmployeeCode: row.requested_by_employee_code,
      requestedByEmployeeName: row.requested_by_employee_name,
      baseEmployeeRevision: row.base_employee_revision,
      baseOrganizationRevision: row.base_organization_revision,
      baseCompanyRevision: row.base_company_revision,
      status:
        row.withdrawn_at !== null
          ? "withdrawn"
          : workflow.status === "pending"
            ? "pending"
            : workflow.status === "approved" || workflow.status === "executed"
              ? "approved"
              : "rejected",
      currentStep: workflow.currentTaskKey,
      createdAt: row.created_at,
      appliedActionId: row.applied_action_id,
      withdrawnAt: row.withdrawn_at,
    }
  } catch (cause) {
    return new CompanyUnexpectedError("人事変更申請を取得できません", { cause })
  }
}
type Context = CompanyContext

export class FindPersonnelActionRequestAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async findPersonnelActionRequest(
    session: CompanyPersonnelSession,
    selector: Readonly<{ id: string } | { applicationId: number }>,
  ): Promise<PersonnelActionRequestRecord | null | CompanyOperationError> {
    return findPersonnelActionRequest(this.c, session, selector)
  }
}
