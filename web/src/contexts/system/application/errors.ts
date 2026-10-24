/**
 * application 層のエラー基底。HTTP status と応答 body を持ち、interface が onError で JSON 化する。
 * 製品に依存しない基盤なので system が所有し、全 context がここから継承する。
 */
export type ApplicationErrorBody = Readonly<
  { error: string; message: string } & Record<string, unknown>
>

export type ApplicationErrorStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 413
  | 415
  | 422
  | 423
  | 429
  | 500
  | 502
  | 503

export type ApplicationErrorOptions = Readonly<{ cause?: unknown }>

export class ApplicationError extends Error {
  readonly layer = "application"
  readonly status: ApplicationErrorStatus
  readonly body: ApplicationErrorBody

  constructor(
    status: ApplicationErrorStatus,
    body: ApplicationErrorBody,
    options: ApplicationErrorOptions = {},
  ) {
    super(body.message, { cause: options.cause })
    this.name = new.target.name
    this.status = status
    this.body = body
  }
}

export class ApplicationBadGatewayError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(502, input, options)
  }
}

export class ApplicationBadRequestError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(400, input, options)
  }
}

export class ApplicationConflictError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(409, input, options)
  }
}

export class ApplicationForbiddenError extends ApplicationError {
  constructor(
    input: ApplicationErrorBody = {
      error: "forbidden",
      message: "この操作を行う権限がありません。",
    },
    options?: ApplicationErrorOptions,
  ) {
    super(403, input, options)
  }
}

export class ApplicationInternalError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(500, input, options)
  }
}

export class ApplicationLockedError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(423, input, options)
  }
}

export class ApplicationNotFoundError extends ApplicationError {
  constructor(
    input: ApplicationErrorBody = {
      error: "not_found",
      message: "対象のデータが見つかりません。削除または更新された可能性があります。",
    },
    options?: ApplicationErrorOptions,
  ) {
    super(404, input, options)
  }
}

export class ApplicationPayloadTooLargeError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(413, input, options)
  }
}

export class ApplicationServiceUnavailableError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(503, input, options)
  }
}

export class ApplicationTooManyRequestsError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(429, input, options)
  }
}

export class ApplicationUnauthorizedError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(401, input, options)
  }
}

export class ApplicationUnprocessableEntityError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(422, input, options)
  }
}

export class ApplicationUnsupportedMediaTypeError extends ApplicationError {
  constructor(input: ApplicationErrorBody, options?: ApplicationErrorOptions) {
    super(415, input, options)
  }
}

export class IamAccountNotFoundApplicationError extends ApplicationNotFoundError {
  constructor(cause?: unknown) {
    super(
      {
        error: "account.not_found",
        message: "対象のアカウントが見つかりません。画面を更新してください。",
        item: null,
      },
      { cause },
    )
  }
}

export class IamAssignmentNotFoundApplicationError extends ApplicationNotFoundError {
  constructor(cause?: unknown) {
    super(
      {
        error: "iam.assignment_not_found",
        message: "対象のロール割当が見つかりません。画面を更新してください。",
      },
      { cause },
    )
  }
}

export class IamRoleNotFoundApplicationError extends ApplicationNotFoundError {
  constructor(cause?: unknown) {
    super(
      {
        error: "iam.role_not_found",
        message: "対象のロールが見つかりません。ロールを選び直してください。",
        item: null,
      },
      { cause },
    )
  }
}

export class InvalidIamAssignmentApplicationError extends ApplicationBadRequestError {
  constructor(
    error: string,
    message: string,
    cause?: unknown,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super({ ...details, error, message, item: null }, { cause })
  }
}

export class JwtSecretMissingApplicationError extends ApplicationInternalError {
  constructor() {
    super({
      error: "jwt_secret_missing",
      message: "ログイン機能の設定に問題があります。管理者にお問い合わせください。",
    })
  }
}

export class OidcInvalidGrantApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super(
      { error: "invalid_grant", message: "The OIDC authorization grant is invalid." },
      { cause },
    )
  }
}

export class OidcInvalidRequestApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super({ error: "invalid_request", message: "The OIDC request is invalid." }, { cause })
  }
}

export class OidcInvalidScopeApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super({ error: "invalid_scope", message: "The requested OIDC scope is invalid." }, { cause })
  }
}

export class OidcInvalidTokenApplicationError extends ApplicationUnauthorizedError {
  constructor(cause?: unknown) {
    super({ error: "invalid_token", message: "The OIDC access token is invalid." }, { cause })
  }
}

export class OidcTemporarilyUnavailableApplicationError extends ApplicationServiceUnavailableError {
  constructor(cause?: unknown) {
    super(
      {
        error: "temporarily_unavailable",
        message: "OIDC user information is temporarily unavailable.",
      },
      { cause },
    )
  }
}

export class PasswordResetRequestApplicationError extends ApplicationInternalError {
  constructor(cause?: unknown) {
    super(
      {
        error: "password_reset_request_failed",
        message: "再設定メールの受付処理に失敗しました。時間をおいてもう一度お試しください。",
      },
      { cause },
    )
  }
}

export class PasswordResetTokenInvalidApplicationError extends ApplicationBadRequestError {
  constructor(cause?: unknown) {
    super(
      {
        error: "reset.token_invalid",
        message: "再設定リンクが正しくありません。もう一度メールを発行してください。",
        item: null,
      },
      { cause },
    )
  }
}

export class PepperSecretMissingApplicationError extends ApplicationInternalError {
  constructor() {
    super({
      error: "pepper_secret_missing",
      message: "パスワード機能の設定に問題があります。管理者にお問い合わせください。",
    })
  }
}

export class SystemAuthPersistenceApplicationError extends ApplicationInternalError {
  constructor(cause?: unknown) {
    super(
      {
        error: "authentication_persistence_failed",
        message: "認証情報を保存できませんでした。時間をおいてもう一度お試しください。",
      },
      { cause },
    )
  }
}
