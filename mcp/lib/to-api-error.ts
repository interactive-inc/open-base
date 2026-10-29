/** 既知のstatusを保ち、読めた本文と読取失敗を区別して診断する。 */
export function toApiError(status: number, body: string | null, contentType: string): Error {
  if (body === null) return new Error(`API ${status}: 応答本文を読み取れませんでした`)
  if (contentType.includes("application/json") && body !== "") {
    try {
      return new Error(`API ${status}: ${JSON.stringify(JSON.parse(body))}`)
    } catch {
      return new Error(`API ${status}: ${body}`)
    }
  }

  return new Error(`API ${status}: ${body}`)
}
