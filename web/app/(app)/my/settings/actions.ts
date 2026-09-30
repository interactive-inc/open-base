"use server"

import { readEmployeeProfileCommand } from "@/lib/form/read-employee-profile-command"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { localeCookieName, zLocale } from "@/lib/i18n/locale"
import { updateMyPhone } from "@/lib/api/update-my-phone"
import { requireAuth } from "@/lib/auth/require-auth"

export type SetLocaleState = {
  ok: boolean
  error: string | null
}

export type UpdatePhoneState = {
  ok: boolean
  error: string | null
}

/**
 * 設定画面の言語切替 Server Action。`useActionState` から呼ばれる。
 * cookie に選択言語を保存する。画面への反映は呼び出し側の `router.refresh()` に任せる。
 */
export async function setLocaleAction(
  _previousState: SetLocaleState,
  formData: FormData,
): Promise<SetLocaleState> {
  const result = zLocale.safeParse(formData.get("locale"))

  if (!result.success) {
    return { ok: false, error: "不正な言語コードです" }
  }

  const cookieStore = await cookies()

  cookieStore.set(localeCookieName, result.data, {
    path: "/",
    maxAge: 31536000,
  })

  return { ok: true, error: null }
}

/**
 * 設定画面の電話番号更新 Server Action。空欄は null として送り、既存の電話番号を消せるようにする。
 */
export async function updatePhoneAction(
  _previousState: UpdatePhoneState,
  formData: FormData,
): Promise<UpdatePhoneState> {
  await requireAuth()

  const rawPhone = formData.get("phone")

  if (typeof rawPhone !== "string") return { ok: false, error: "電話番号の入力を確認してください" }

  const phone = rawPhone.trim() === "" ? null : rawPhone.trim()

  const command = readEmployeeProfileCommand(formData)
  if (command instanceof Error) return { ok: false, error: command.message }
  const updated = await updateMyPhone(
    { phone, profile: command.profile, reason: command.reason },
    command.commandId,
  )

  if (updated instanceof Error) {
    return { ok: false, error: updated.message }
  }

  // 電話番号は app-shell（layout）が渡す me から設定モーダルへ流れるので、
  // ページ単位ではなく layout を revalidate しないと保存後も古い値が残る。
  revalidatePath("/", "layout")

  return { ok: true, error: null }
}
