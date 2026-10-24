/** APIはオリジンの `/api` 配下にある。接続先の設定とtokenの保存はオリジン単位のまま扱う。 */
export function apiUrl(path: string, baseUrl: string): URL {
  return new URL(`/api${path}`, baseUrl)
}

/** hc に渡す基底URL。hc は基底URLの後ろへ経路を連結する。 */
export function apiBaseUrl(baseUrl: string): string {
  return apiUrl("", baseUrl).toString().replace(/\/$/, "")
}
