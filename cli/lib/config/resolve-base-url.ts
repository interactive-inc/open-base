/**
 * 接続先 API の URL を解決する。--base-url 指定 > 環境変数 BASE_API > 既定。
 * 接続先はファイルに永続化せず毎回この順で解決する。env は（テスト隔離のため）呼び出し時に読む。
 */
export function resolveBaseUrl(override?: string | null): string {
  if (override !== undefined && override !== null && override !== "") {
    return override
  }

  const fromEnv = process.env.BASE_API

  if (fromEnv !== undefined && fromEnv !== "") {
    return fromEnv
  }

  return "http://127.0.0.1:18787"
}
