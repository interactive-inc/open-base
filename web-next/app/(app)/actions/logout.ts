"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { apiFetch } from "@/lib/api/api-fetch"

/**
 * ログアウト Server Action。
 * 1. サーバー側でリフレッシュトークンのファミリーを失効させる
 * 2. クライアント側の cookie を破棄する
 * 3. LOGOUT_REDIRECT_URL（未設定なら "/"）へ遷移する。ログイン画面を外部に
 *    持つ構成では、そのログイン入口の URL を設定する
 * API 呼び出しが失敗してもクライアント側のログアウトは必ず実行する。
 */
export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies()
  const refreshToken = cookieStore.get("refresh_token")?.value

  if (refreshToken !== undefined) {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://base.localhost"

      await apiFetch(`${baseUrl}/system/sessions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch {
      // API failure must not block client-side logout
    }
  }

  cookieStore.delete("session")

  cookieStore.delete("refresh_token")

  redirect(process.env.LOGOUT_REDIRECT_URL ?? "/")
}
