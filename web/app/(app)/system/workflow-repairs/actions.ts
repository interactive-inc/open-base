"use server"

import { revalidatePath } from "next/cache"
import { parseCandidateEmployeeIds } from "@/app/(app)/system/workflow-repairs/_lib/parse-candidate-employee-ids"
import { canManageWorkflowRepairs } from "@/lib/application/can-manage-workflow-repairs"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { getMe } from "@/lib/api/get-me"
import { reassignWorkflowStep } from "@/lib/api/reassign-workflow-step"
import { toEntityId } from "@/lib/form/to-entity-id"
import { toPositiveIntId } from "@/lib/form/to-positive-int-id"

export type WorkflowRepairState = { ok: boolean; error: string | null }

export async function reassignWorkflowStepAction(
  _previous: WorkflowRepairState,
  formData: FormData,
): Promise<WorkflowRepairState> {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageWorkflowRepairs(currentUser.permissions) === false) {
    return { ok: false, error: "承認フローを修復する権限がありません" }
  }

  const applicationId = toEntityId(formData.get("application_id"))
  const rawCandidates = formData.get("candidate_employee_ids")
  const rawRequiredApprovals = formData.get("required_approvals")
  const rawReason = formData.get("reason")

  if (applicationId === null) {
    return { ok: false, error: "修復対象の申請を特定できません" }
  }

  if (typeof rawCandidates !== "string") {
    return { ok: false, error: "候補従業員 ID を入力してください" }
  }

  const candidateEmployeeIds = parseCandidateEmployeeIds(rawCandidates)

  if (candidateEmployeeIds === null) {
    return {
      ok: false,
      error: "候補従業員 ID はカンマ区切りで 1〜20 件入力してください",
    }
  }

  const requiredApprovals =
    rawRequiredApprovals === null || rawRequiredApprovals === ""
      ? undefined
      : toPositiveIntId(rawRequiredApprovals)

  if (requiredApprovals === null || (requiredApprovals ?? 0) > 20) {
    return { ok: false, error: "必要承認数は 1〜20 の整数で入力してください" }
  }

  if (typeof rawReason !== "string" || rawReason.trim() === "") {
    return { ok: false, error: "再割当理由を入力してください" }
  }

  const reason = rawReason.trim()

  if (reason.length > 1_000) {
    return { ok: false, error: "再割当理由は 1000 文字以内で入力してください" }
  }

  const result = await reassignWorkflowStep(applicationId, {
    candidate_employee_ids: candidateEmployeeIds,
    required_approvals: requiredApprovals,
    reason,
  })

  if (result instanceof Error) {
    return { ok: false, error: toRepairErrorMessage(result) }
  }

  revalidatePath("/system/workflow-repairs")
  revalidatePath(`/system/applications/${applicationId}`)
  revalidatePath("/inbox/applications")

  return { ok: true, error: null }
}

function toRepairErrorMessage(error: Error): string {
  if (error instanceof ApiResponseError) {
    if (error.code === "invalid_candidate") {
      return "申請者自身または操作している本人は承認候補にできません"
    }

    if (error.code === "workflow_unresolvable") {
      return "有効なアカウントを持ち、必要な承認数を満たす候補者を指定してください"
    }

    if (error.code === "workflow_quorum_required") {
      return "全員承認のスナップショットがないため、候補者数と同じ必要承認数を入力してください"
    }

    if (error.code === "workflow_quorum_mismatch") {
      return "必要承認数は候補者数または保存済みの承認数と一致させてください"
    }

    if (error.code === "workflow_not_repairable") {
      return "この承認ステップは現在修復を必要としていません"
    }

    if (error.code === "already_decided") {
      return "申請の状態が変わりました。画面を更新して確認してください"
    }
  }

  return "承認候補者を再割当できませんでした"
}
