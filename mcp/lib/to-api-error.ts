/** JSONを名乗る障害応答が壊れていても、元のstatusと本文を診断に残す。 */
export function toApiError(status: number, body: string, contentType: string): Error {
  if (contentType.includes("application/json") && body !== "") {
    try {
      return new Error(`API ${status}: ${JSON.stringify(JSON.parse(body))}`)
    } catch {
      return new Error(`API ${status}: ${body}`)
    }
  }

  return new Error(`API ${status}: ${body}`)
}
