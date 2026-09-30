/**
 * API への接続失敗・タイムアウトを、接続先を添えた実用的なメッセージに変換する。
 * 接続エラーと判定できない場合は null を返し、呼び出し側は元のメッセージを使う
 * （CLI 内部の実装バグを「接続できません」と誤表示しないため）。
 */
export function toConnectionErrorMessage(error: unknown, baseUrl: string): string | null {
  if (error instanceof Error === false) {
    return null
  }

  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return `API (${baseUrl}) への接続がタイムアウトしました。サーバの起動状態や接続先（環境変数 BASE_API）を確認してください。`
  }

  if (isConnectionFailure(error.message)) {
    return `API (${baseUrl}) に接続できませんでした。サーバが起動しているか、接続先（環境変数 BASE_API）を確認してください。`
  }

  return null
}

/** fetch がネットワーク層で失敗したときの代表的なメッセージを判定する。 */
function isConnectionFailure(message: string): boolean {
  return /fetch failed|failed to fetch|unable to connect|connection refused|econnrefused/i.test(
    message,
  )
}
