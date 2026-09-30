/**
 * API がエラー応答を返したことを表す。HTTP status を保持し、呼び出し側（詳細ページ）が
 * 401→AuthError、404→notFound、その他(403/5xx/503)→error boundary へ振り分けられるようにする。
 * code は api の {error, code} 応答の機械判定用識別子（last_admin 等）。呼び出し側が
 * ユーザー向け文言へ分岐するために使う。ボディに code が無い応答では null。
 * Error を継承するため、既存の `instanceof Error` による判定はそのまま機能する。
 */
export class ApiResponseError extends Error {
  readonly status: number

  readonly code: string | null

  constructor(status: number, message: string, code: string | null = null) {
    super(message)

    this.name = "ApiResponseError"
    this.status = status
    this.code = code
  }
}
