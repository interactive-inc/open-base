import { notFound } from "next/navigation"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { AuthError } from "@/lib/api/auth-error"

/**
 * 詳細ページの取得失敗を Next.js の挙動に振り分ける。
 * 401: 認証切れ → AuthError で error boundary へ。404: 不在 → notFound()。
 * それ以外(403/5xx/503): 再 throw し error.tsx へ。
 * status を持たない一般 Error も再 throw する。notFound/throw はいずれも
 * 制御を中断するため戻り値は never で、呼び出し後は対象が非 Error に絞り込まれる。
 */
export function handleDetailError(error: Error): never {
  if (error instanceof ApiResponseError) {
    if (error.status === 401) {
      throw new AuthError()
    }

    if (error.status === 404) {
      notFound()
    }
  }

  throw error
}
