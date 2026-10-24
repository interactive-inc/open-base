import { cookies } from "next/headers"

/**
 * httpOnly cookie `step_up` に保存した再認証 grant を取り出す。
 * Server Action 専用。無い・空のときは null を返し、呼び出し側はヘッダを付けずに送る。
 */
export async function getStepUpToken(): Promise<string | null> {
  const cookieStore = await cookies()

  const stepUpCookie = cookieStore.get("step_up")

  if (stepUpCookie === undefined) {
    return null
  }

  if (stepUpCookie.value === "") {
    return null
  }

  return stepUpCookie.value
}
