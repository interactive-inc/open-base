import { ApiError } from "@/lib/errors"

/**
 * hc クライアントの ClientResponse は標準 Response と構造的に非互換なので、
 * 検査に必要なメンバだけを持つ最小の型で受ける。
 */
type CheckableResponse = {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

/**
 * 4xx/5xx なら ApiError を投げて index.ts の onError で stderr + exit 1 に落とす。
 * 成功時は本文を読まないので、呼び出し側の json() と二重読みにならない。
 */
export async function ensureOk(response: CheckableResponse): Promise<void> {
  if (response.ok) return

  let detail: string

  try {
    detail = JSON.stringify(await response.json())
  } catch {
    detail = await response.text()
  }

  throw new ApiError(response.status, `ERR ${response.status} ${detail}`)
}
