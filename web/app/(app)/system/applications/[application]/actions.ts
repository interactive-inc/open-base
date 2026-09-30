"use server"

import type { EntityId } from "@/lib/api/types/entity-id"
import { z } from "zod"
import type { ApplicationDecisionTarget } from "@/lib/api/types/application-types"
import { revalidatePath } from "next/cache"
import { approveApplication } from "@/lib/api/approve-application"
import { getMe } from "@/lib/api/get-me"
import { rejectApplication } from "@/lib/api/reject-application"
import { toEntityId } from "@/lib/form/to-entity-id"

export type DecisionState = {
  ok: boolean
  error: string | null
}

/** 承認処理。コメント任意。 */
async function approve(
  applicationId: EntityId,
  comment: string | null,
  decisionTarget: ApplicationDecisionTarget,
): Promise<DecisionState> {
  const decided = await approveApplication(applicationId, comment, decisionTarget)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  return { ok: true, error: null }
}

/** 却下処理。コメント必須。 */
async function reject(
  applicationId: EntityId,
  comment: string | null,
  decisionTarget: ApplicationDecisionTarget,
): Promise<DecisionState> {
  if (comment === null) {
    return { ok: false, error: "承認しない理由を入力してください" }
  }

  const decided = await rejectApplication(applicationId, comment, decisionTarget)

  if (decided instanceof Error) {
    return { ok: false, error: decided.message }
  }

  return { ok: true, error: null }
}

/** 承認/却下を 1 つにまとめた Server Action。decision フィールドで分岐し、成功時は inbox を再検証する。 */
export async function decideApplicationAction(
  previousState: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const currentUser = await getMe()

  // 会社上の判断資格はAPIで再検査する。
  if (currentUser instanceof Error) {
    return { ok: false, error: "申請を承認・却下する権限がありません" }
  }

  const applicationId = toEntityId(formData.get("application_id"))

  if (applicationId === null) {
    return { ok: false, error: "申請が指定されていません" }
  }

  const target = z
    .object({
      proposal_version: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
      task_key: z.string().min(1).max(100),
      task_round: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .safeParse({
      proposal_version: formData.get("proposal_version"),
      proposal_digest: formData.get("proposal_digest"),
      task_key: formData.get("task_key"),
      task_round: formData.get("task_round"),
    })
  if (!target.success)
    return { ok: false, error: "確認した申請を特定できません。詳細を再読み込みしてください" }

  const decision = formData.get("decision")

  const rawComment = formData.get("comment")

  const comment =
    typeof rawComment === "string" && rawComment.trim() !== "" ? rawComment.trim() : null

  if (decision !== "approve" && decision !== "reject") {
    return { ok: false, error: "操作が不正です" }
  }

  const decide = async () => {
    if (decision === "approve") return approve(applicationId, comment, target.data)
    return reject(applicationId, comment, target.data)
  }
  const result = await decide()

  if (!result.ok) {
    return result
  }

  revalidatePath(`/system/applications/${applicationId}`)

  revalidatePath("/inbox/applications")

  revalidatePath("/my/applications")

  return result
}
