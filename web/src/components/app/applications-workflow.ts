import type { WorkflowApprover, WorkflowStep } from "@/components/app/application-types"

const APPROVER_TYPE_TEXT: Readonly<Record<WorkflowApprover["type"], string>> = {
  direct_manager: "申請者の直属の上長",
  department_manager: "申請者の部署の責任者",
  target_department_manager: "対象の部署の責任者",
  management_chain: "申請者の上長を順にたどる",
  responsibility: "会社で定めた責任を持つ人",
  employee: "決まった従業員",
}

const APPROVAL_MODE_TEXT: Readonly<Record<WorkflowStep["approval_mode"], string>> = {
  any: "誰か一人が承認すれば進む",
  all: "全員の承認で進む",
  minimum: "決めた人数の承認で進む",
}

export const REJECTION_TEXT: Readonly<Record<WorkflowStep["rejection_behavior"], string>> = {
  reject: "却下して終える",
  return: "申請者へ差し戻す",
}

/** 承認者を一行の文で表す。 */
export function describeApprover(approver: WorkflowApprover): string {
  if (approver.type === "employee") return `従業員 ${approver.employee_code}`
  if (approver.type === "responsibility") {
    return approver.organization_unit_code === null
      ? `責任 ${approver.responsibility_type}`
      : `責任 ${approver.responsibility_type}（${approver.organization_unit_code}）`
  }
  return APPROVER_TYPE_TEXT[approver.type]
}

/** 段階の進み方を一行の文で表す。会社の責任の設定で承認者が決まる段階は、その旨を返す。 */
export function describeApprovalMode(step: WorkflowStep): string {
  if (step.governance_authority !== undefined) return "会社の責任の設定で承認者と人数が決まる"
  if (step.approval_mode === "minimum" && step.minimum_approvals !== undefined) {
    return `${step.minimum_approvals}人の承認で進む`
  }
  return APPROVAL_MODE_TEXT[step.approval_mode]
}

/** 条件や引き継ぎ先など、一覧に出さない設定を持つ段階。 */
export function hasHiddenSettings(step: WorkflowStep): boolean {
  return (step.conditions?.length ?? 0) > 0 || (step.escalation_approvers?.length ?? 0) > 0
}
