/** 読取失敗を空本文と区別し、呼出し側の中断はそのまま伝える。 */
export async function readResponseErrorBody(
  response: Readonly<Pick<Response, "text">>,
  signal: AbortSignal | null = null,
): Promise<string | null> {
  try {
    return await response.text()
  } catch (error) {
    if (signal?.aborted) throw error
    return null
  }
}
