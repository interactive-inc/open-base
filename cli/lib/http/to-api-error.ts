import { ApiError } from "@/lib/errors"

/** 本文は一度だけ読み、JSONでない障害応答でも元のstatusを維持する。 */
export function toApiError(status: number, body: string): ApiError {
  if (body === "") return new ApiError(status, `ERR ${status}`)

  try {
    return new ApiError(status, `ERR ${status} ${JSON.stringify(JSON.parse(body))}`)
  } catch {
    return new ApiError(status, `ERR ${status} ${body}`)
  }
}
