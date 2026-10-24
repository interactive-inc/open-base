import { HTTPException } from "hono/http-exception"

/**
 * API レイヤーの責務のエラー。HTTP セマンティクスを名前で表す。
 * 以下のエラー群はすべて HTTPException を継承するので、Hono の onError / Workers の例外処理にそのまま乗る
 */
export class UnauthorizedError extends HTTPException {
  constructor(message = "unauthorized") {
    super(401, { message })
  }
}

export class ForbiddenError extends HTTPException {
  constructor(message = "forbidden") {
    super(403, { message })
  }
}

export class NotFoundError extends HTTPException {
  constructor(message: string) {
    super(404, { message })
  }
}

export class ConflictError extends HTTPException {
  constructor(message: string) {
    super(409, { message })
  }
}

export class BadRequestError extends HTTPException {
  constructor(message: string) {
    super(400, { message })
  }
}

export class UnprocessableEntityError extends HTTPException {
  constructor(message: string) {
    super(422, { message })
  }
}

export class InternalError extends HTTPException {
  constructor(message: string) {
    super(500, { message })
  }
}
