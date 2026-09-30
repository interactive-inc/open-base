"use server"

import { redirect } from "next/navigation"
import { submitApplication } from "@/lib/api/submit-application"
import { requireAuth } from "@/lib/auth/require-auth"

export type SubmitState = {
  ok: boolean
  error: string | null
}

/** 入力 JSON 文字列を payload オブジェクトへ変換する。空文字は空オブジェクト扱い。 */
function toPayload(rawPayload: string): Record<string, unknown> | Error {
  const trimmed = rawPayload.trim()

  if (trimmed === "") {
    return {}
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return new Error("payload は有効な JSON で入力してください")
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return new Error("payload は JSON オブジェクトで入力してください")
  }

  return { ...parsed }
}

/** 申請提出 Server Action。useActionState から呼ばれ、成功時は作成された申請詳細へ redirect。 */
export async function submitApplicationAction(
  previousState: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  await requireAuth()

  const templateCode = formData.get("template_code")

  const rawPayload = formData.get("payload")

  if (typeof templateCode !== "string" || templateCode === "") {
    return { ok: false, error: "テンプレートが指定されていません" }
  }

  const payloadInput = typeof rawPayload === "string" ? rawPayload : ""

  const payload = toPayload(payloadInput)

  if (payload instanceof Error) {
    return { ok: false, error: payload.message }
  }

  const created = await submitApplication({
    template_code: templateCode,
    payload: payload,
  })

  if (created instanceof Error) {
    return { ok: false, error: created.message }
  }

  redirect(`/system/applications/${created.id}`)
}
