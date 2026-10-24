import {
  CompanyHTTPException,
  type CompanyHTTPExceptionStatus,
} from "@/contexts/company/interface/errors"
import { OIDCHTTPException, SystemHTTPException } from "@system/interface/errors"
import { ApplicationError } from "@/lib/errors"
import type { Context, Env } from "hono"
import { HTTPException } from "hono/http-exception"

const companyProblemTitleByStatus: Readonly<Record<CompanyHTTPExceptionStatus, string>> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  423: "Locked",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
}

/**
 * API 全体の例外を外部向け JSON に変換し、内部情報を応答へ漏らさない。
 */
export function handleApiError<E extends Env>(error: Error, context: Context<E>): Response {
  if (error instanceof OIDCHTTPException) {
    if (error.status >= 500) console.error("[expected server error]", error.cause ?? error)
    if (error.authenticate !== null) {
      context.header("WWW-Authenticate", error.authenticate)
    }

    return context.json({ error: error.code }, error.status, {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    })
  }

  if (error instanceof SystemHTTPException) {
    if (error.status >= 500) console.error("[expected server error]", error.cause ?? error)

    return context.json({ error: error.detail, code: error.code, ...error.metadata }, error.status)
  }

  if (error instanceof CompanyHTTPException) {
    if (error.status >= 500) console.error("[expected server error]", error.cause ?? error)
    if (error.etag !== null) context.header("etag", error.etag)

    return context.json(
      {
        ...error.metadata,
        type: `/problems/${error.code}`,
        title: companyProblemTitleByStatus[error.status],
        status: error.status,
        code: error.code,
        detail: error.detail,
        ...(error.issues === null ? {} : { issues: error.issues }),
      },
      error.status,
      { "content-type": "application/problem+json" },
    )
  }

  if (error instanceof HTTPException) {
    if (error.cause instanceof ApplicationError) {
      if (error.status >= 500) {
        console.error("[expected server error]", error.cause.cause ?? error.cause)
      }

      return context.json({ error: error.message, code: error.cause.code }, error.status)
    }

    if (error.res) {
      return error.getResponse()
    }

    return context.json({ error: error.message }, error.status)
  }

  console.error("[unhandled error]", error)

  return context.json({ error: "internal server error" }, 500)
}
