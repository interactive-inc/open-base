import { HTTPException } from "hono/http-exception"
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PayloadTooLargeError,
  UnavailableError,
  UnprocessableError,
  ValidationError,
} from "@/lib/errors"
import type { ApplicationError } from "@/lib/errors"

/**
 * application 層の失敗を HTTP セマンティクスへ翻訳する。JSON は API の onError だけが生成する。
 */
export function toHttpException(error: ApplicationError): HTTPException {
  let status: 400 | 403 | 404 | 409 | 413 | 422 | 500 | 503 = 500

  if (error instanceof NotFoundError) status = 404
  else if (error instanceof ForbiddenError) status = 403
  else if (error instanceof ConflictError) status = 409
  else if (error instanceof ValidationError) status = 400
  else if (error instanceof UnprocessableError) status = 422
  else if (error instanceof PayloadTooLargeError) status = 413
  else if (error instanceof UnavailableError) status = 503

  return new HTTPException(status, {
    message: error.message,
    cause: error,
  })
}
