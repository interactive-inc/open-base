import { ApiResponseError } from "@/lib/api/api-response-error"

/**
 * 失敗レスポンス（status >= 400）から ApiResponseError を組み立てる。
 * api の onError は toHttpException 経由で {error, code} の JSON を返す（api の app.ts / to-http-exception.ts 参照）。
 * message は message ベースの toResponseError と違い、ここでは機械判定用の code を運ぶ。
 * 呼び出し側（Server Action）が code を見てユーザー向け文言へ分岐できるようにするのが目的。
 *
 * 403（self_assignment / self_deactivation / role_escalation 等）も対象なので、
 * 409 限定の toResponseError と違い status を絞らず常にボディを読む。
 * ボディが読めない・形が違う場合は message/code を fallback/null にする。
 */
export async function toApiResponseError(
  response: { status: number; json(): Promise<unknown> },
  fallbackMessage: string,
): Promise<ApiResponseError> {
  const body = await readApiErrorBody(response)

  if (body === null) {
    return new ApiResponseError(response.status, fallbackMessage, null)
  }

  return new ApiResponseError(response.status, body.error ?? fallbackMessage, body.code)
}

type ApiErrorBody = {
  error: string | null
  code: string | null
}

/**
 * レスポンスボディから api の {error, code} を安全に取り出す。
 * JSON でない・読み取りに失敗した場合は null を返す。
 * error / code はそれぞれ文字列でなければ null にする。
 */
async function readApiErrorBody(response: {
  json(): Promise<unknown>
}): Promise<ApiErrorBody | null> {
  try {
    const body = await response.json()

    if (typeof body !== "object" || body === null) {
      return null
    }

    const error = "error" in body && typeof body.error === "string" ? body.error : null

    const code = "code" in body && typeof body.code === "string" ? body.code : null

    return { error: error, code: code }
  } catch {
    return null
  }
}
