/**
 * 失敗レスポンスからユーザー向け Error を組み立てる。
 * api の onError は `{ error: message }` または Company の `{ detail: message }` を返す。
 * 従来の各ミューテーション関数は status もボディも読まず汎用文言で潰していたため、
 * 409 Conflict の具体的な理由（期間重複・残日数不足など）がユーザーに届かなかった。
 *
 * このヘルパは body を安全に読み取り、409 のときだけ api の理由メッセージを
 * conflictMessages（api メッセージ → 日本語）で変換して伝える。
 * - 409 かつ conflictMessages にキーが一致 → そのマップ値で日本語 Error
 * - 409 だがマップ未ヒット → fallback に理由を併記した Error
 * - 409 以外 → fallback のみ（従来挙動）
 *
 * body の読み取りは try/catch + 形状チェックで安全に行い、
 * error / detail が文字列でなければ無視する。
 */
export async function toResponseError(
  response: { status: number; json(): Promise<unknown> },
  options: { fallback: string; conflictMessages?: Record<string, string> },
): Promise<Error> {
  const apiMessage = await readApiErrorMessage(response)

  if (response.status !== 409 || apiMessage === null) {
    return new Error(options.fallback)
  }

  const mapped = options.conflictMessages?.[apiMessage]

  if (mapped !== undefined) {
    return new Error(mapped)
  }

  return new Error(`${options.fallback}（${apiMessage}）`)
}

/**
 * レスポンスボディから api のエラーメッセージ文字列を安全に取り出す。
 * JSON でない・形が違う・読み取りに失敗した場合は null を返す。
 */
async function readApiErrorMessage(response: { json(): Promise<unknown> }): Promise<string | null> {
  try {
    const body = await response.json()

    if (typeof body !== "object" || body === null) return null

    if ("error" in body && typeof body.error === "string") return body.error

    if ("detail" in body && typeof body.detail === "string") return body.detail

    return null
  } catch {
    return null
  }
}
