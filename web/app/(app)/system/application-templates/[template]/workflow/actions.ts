"use server"

import { revalidatePath } from "next/cache"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import { getMe as getUser } from "@/lib/api/get-me"
import { ApiResponseError } from "@/lib/api/api-response-error"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"
import { updateApplicationWorkflow } from "@/lib/api/update-application-workflow"

export type WorkflowFormState = { ok: boolean; error: string | null; revision: number }

export async function saveWorkflowAction(
  _previous: WorkflowFormState,
  formData: FormData,
): Promise<WorkflowFormState> {
  const user = await getUser()
  if (user instanceof Error || canManageApplicationTemplates(user.permissions) === false) {
    return {
      ok: false,
      error: "承認フローを管理する権限がありません",
      revision: _previous.revision,
    }
  }
  const code = formData.get("code")
  const definition = formData.get("workflow_json")
  const expectedRevisionInput = formData.get("expected_revision")
  if (
    typeof code !== "string" ||
    typeof definition !== "string" ||
    typeof expectedRevisionInput !== "string"
  ) {
    return { ok: false, error: "承認フローの入力が不正です", revision: _previous.revision }
  }
  const expectedRevision = Number(expectedRevisionInput)
  if (
    Number.isSafeInteger(expectedRevision) === false ||
    expectedRevision < 0 ||
    String(expectedRevision) !== expectedRevisionInput
  ) {
    return { ok: false, error: "承認フローの改版番号が不正です", revision: _previous.revision }
  }
  let workflow: ApplicationWorkflow
  try {
    workflow = JSON.parse(definition) as ApplicationWorkflow
  } catch {
    return { ok: false, error: "詳細JSONが不正です", revision: expectedRevision }
  }
  const saved = await updateApplicationWorkflow(code, workflow, expectedRevision)
  if (saved instanceof ApiResponseError && saved.code === "workflow_revision_conflict") {
    return {
      ok: false,
      error:
        "他の管理者が先に承認フローを更新しました。画面を再読み込みして変更を確認してください。",
      revision: expectedRevision,
    }
  }
  if (saved instanceof Error) {
    return { ok: false, error: saved.message, revision: expectedRevision }
  }
  revalidatePath(`/system/application-templates/${code}/workflow`)
  return { ok: true, error: null, revision: saved.revision }
}
