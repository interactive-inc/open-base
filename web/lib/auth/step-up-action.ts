"use server"

import { cookies } from "next/headers"
import { issueStepUpGrant } from "@/lib/api/issue-step-up-grant"
import { setStepUpCookie } from "@/lib/auth/set-step-up-cookie"
import { stepUpCookieMaxAge } from "@/lib/auth/step-up-cookie-max-age"

export type StepUpFormState = {
  ok: boolean
  error: string | null
}

/**
 * 再認証ダイアログの Server Action。パスワードから step-up grant を発行し cookie に置く。
 * パスワードは cookie にもログにも戻り値にも残さない。
 */
export async function stepUpAction(
  _previousState: StepUpFormState,
  formData: FormData,
): Promise<StepUpFormState> {
  const password = formData.get("password")

  if (typeof password !== "string" || password === "") {
    return { ok: false, error: "パスワードを入力してください" }
  }

  const grant = await issueStepUpGrant(password)

  if (grant instanceof Error) {
    if (grant.code === "invalid_credentials") {
      return { ok: false, error: "パスワードが違います" }
    }

    return { ok: false, error: "再認証に失敗しました" }
  }

  const maxAge = stepUpCookieMaxAge(grant.expiresAt, new Date())

  if (maxAge === null) {
    return { ok: false, error: "再認証に失敗しました" }
  }

  const cookieStore = await cookies()

  setStepUpCookie({ cookieStore: cookieStore, stepUpToken: grant.stepUpToken, maxAge: maxAge })

  return { ok: true, error: null }
}
