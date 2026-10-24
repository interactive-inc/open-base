/**
 * application 層が返す失敗の基底。素の Error や { reason } 判別ユニオンを上位へ漏らさず、
 * code（機械判定用の安定した識別子。旧 reason に相当）と message（人間可読の説明）で表現する。
 * infrastructure が返した素エラーや DB の内部情報は options.cause に隠し、message には載せない。
 * interface 層は instanceof で HTTP ステータスへ翻訳し、message と code だけを応答に出す
 */
export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(message, options)

    this.name = "ApplicationError"
  }
}

/**
 * 対象の資源が見つからない（HTTP 404 相当）
 */
export class NotFoundError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "NotFoundError"
  }
}

/**
 * 権限が無く操作を拒否する（HTTP 403 相当）
 */
export class ForbiddenError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "ForbiddenError"
  }
}

/**
 * 資源の状態が操作と矛盾する（重複・遷移不可・利用中など。HTTP 409 相当）
 */
export class ConflictError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "ConflictError"
  }
}

/**
 * 入力が不正で処理できない（HTTP 400 相当）
 */
export class ValidationError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "ValidationError"
  }
}

/**
 * 入力の形式は正しいが内容を処理できない（HTTP 422 相当）
 */
export class UnprocessableError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "UnprocessableError"
  }
}

/**
 * 要求または生成物が安全な処理上限を超える（HTTP 413 相当）
 */
export class PayloadTooLargeError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "PayloadTooLargeError"
  }
}

/**
 * 必須の監査・外部依存を利用できず、安全に処理を継続できない（HTTP 503 相当）
 */
export class UnavailableError extends ApplicationError {
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options)

    this.name = "UnavailableError"
  }
}

/**
 * 想定外の失敗。infrastructure が返した素のエラーや、満たされるはずの不変条件の破れを表す。
 * 内部情報は cause に隠し、message には安全な説明だけを載せる（HTTP 500 相当）
 */
export class UnexpectedError extends ApplicationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "unexpected", options)

    this.name = "UnexpectedError"
  }
}
