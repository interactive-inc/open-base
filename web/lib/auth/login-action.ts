"use server"

import { cookies } from "next/headers"
import { postLogin } from "@/lib/api/post-login"
import { setSessionCookies } from "@/lib/auth/set-session-cookies"
import { getTranslator } from "@/lib/i18n/get-translator"

export type LoginState = {
  ok: boolean
  error: string | null
}

/**
 * ログインフォームの Server Action。`useActionState` から呼ばれる。
 * 成功時は session cookie を立て、Client Component へ成功を返す。
 * error boundary の reset で現在の URL を再描画するため、ここでは redirect しない。
 */
export async function loginAction(
  previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const t = await getTranslator()

  const email = formData.get("email")

  const password = formData.get("password")

  if (typeof email !== "string" || typeof password !== "string") {
    return { ok: false, error: t("メールアドレスとパスワードを入力してください") }
  }

  const result = await postLogin({ email, password })

  if (result instanceof Error) {
    return { ok: false, error: t("メールアドレスまたはパスワードが正しくありません") }
  }

  const cookieStore = await cookies()

  setSessionCookies({
    cookieStore,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
  })

  return { ok: true, error: null }
}
