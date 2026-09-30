"use server"

import { revalidatePath } from "next/cache"
import { updateApplication } from "@/lib/api/update-application"
import { withdrawApplication } from "@/lib/api/withdraw-application"
import { resubmitApplication } from "@/lib/api/resubmit-application"
import { toEntityId } from "@/lib/form/to-entity-id"
import { requireAuth } from "@/lib/auth/require-auth"

/** useActionState で参照する共通の戻り値。ok=成功 / error=表示するエラー文言。 */
export type ApplicationActionState = {
  ok: boolean
  error: string | null
}

/**
 * 申請内容更新 Server Action。application_id と payload(JSON 文字列) が必須。
 * 審査済みや本人以外は api がエラーを返す。成功時は /applications を revalidate する。
 */
export async function updateApplicationAction(
  previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  await requireAuth()

  const applicationId = toEntityId(formData.get("application_id"))

  if (applicationId === null) {
    return { ok: false, error: "申請を特定できませんでした" }
  }

  const payload = toPayload(formData.get("payload"))

  if (payload instanceof Error) {
    return {
      ok: false,
      error: "申請内容の形式が正しくありません。括弧や引用符の対応を確認してください。",
    }
  }

  const updated = await updateApplication(applicationId, payload)

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  revalidatePath("/my/applications")

  return { ok: true, error: null }
}

export async function resubmitApplicationAction(
  _previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  await requireAuth()

  const applicationId = toEntityId(formData.get("application_id"))
  if (applicationId === null) return { ok: false, error: "申請を特定できませんでした" }
  const payload = toPayload(formData.get("payload"))
  if (payload instanceof Error) return { ok: false, error: "申請内容の形式が正しくありません" }
  const result = await resubmitApplication(applicationId, payload)
  if (result instanceof Error) return { ok: false, error: result.message }
  revalidatePath("/my/applications")
  revalidatePath(`/system/applications/${applicationId}`)
  return { ok: true, error: null }
}

/** 申請取り下げ Server Action。application_id が必須。成功時は /applications を revalidate する。 */
export async function withdrawApplicationAction(
  previousState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  await requireAuth()

  const applicationId = toEntityId(formData.get("application_id"))

  if (applicationId === null) {
    return { ok: false, error: "申請を特定できませんでした" }
  }

  const withdrawn = await withdrawApplication(applicationId)

  if (withdrawn instanceof Error) {
    return { ok: false, error: withdrawn.message }
  }

  revalidatePath("/my/applications")

  return { ok: true, error: null }
}

/** payload の FormData 値(JSON 文字列) を unknown へ。解析できなければ Error。 */
function toPayload(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string" || value.trim() === "") {
    return new Error("payload is empty")
  }

  try {
    return JSON.parse(value)
  } catch (error) {
    return error instanceof Error ? error : new Error("invalid payload json")
  }
}
