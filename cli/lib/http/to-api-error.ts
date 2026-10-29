import { ApiError } from "@/lib/errors"

/** 本文の読取やJSONの解釈が失敗しても、既知のHTTP statusを維持する。 */
export function toApiError(status: number, body: string | null): ApiError {
  if (body === null) return new ApiError(status, `ERR ${status} 応答本文を読み取れませんでした`)
  if (body === "") return new ApiError(status, `ERR ${status}`)

  try {
    return new ApiError(status, `ERR ${status} ${JSON.stringify(JSON.parse(body))}`)
  } catch {
    return new ApiError(status, `ERR ${status} ${body}`)
  }
}
