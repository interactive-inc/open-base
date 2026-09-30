import { apiFetch } from "@/lib/api/api-fetch"
import { getServerSession } from "@/lib/auth/get-server-session"
import type { ApiClient, AppType } from "api/app"
import { hc } from "hono/client"

/**
 * ネットワーク失敗（接続拒否・DNS 失敗・タイムアウト）を 503 Response に変換する。
 * hc は fetch の例外をそのまま投げ、未ハンドル例外が Next.js に伝播して汎用 500 になる。
 * 503 に変換することで各 API 関数の status/ok 判定に乗り、Error として扱える。
 * 変換するのはネットワーク失敗（fetch は TypeError を投げる）のみ。不正 URL 等の
 * プログラミングエラーまで 503 に握り潰さないよう、それ以外は再 throw する。
 */
const fetchWithNetworkGuard: typeof fetch = async (input, init) => {
  try {
    return await apiFetch(input, init)
  } catch (error) {
    if (error instanceof TypeError) {
      return Response.json({ error: "api unreachable" }, { status: 503 })
    }

    throw error
  }
}

/**
 * AppType / ApiClient は type-only で import し、hc<AppType>() を web 側で生成する。
 * app 本体を実行時 import すると全ルートが Turbopack に取り込まれ @/ 解決に失敗するため、
 * cli と同じく型のみ参照する（HonoBase の schema 抽出は AppType 経由で効く）。
 */
export async function createClient(): Promise<ApiClient> {
  const token = await getServerSession()

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://base.localhost"

  const headers: Record<string, string> = {
    "X-Open-Base-Client": "web",
  }

  if (token !== null) {
    headers.Authorization = `Bearer ${token}`
  }

  return hc<AppType>(baseUrl, { headers, fetch: fetchWithNetworkGuard })
}

export type Client = ApiClient
