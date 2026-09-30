import type { HonoEnv } from "@/env"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { createMiddleware } from "hono/factory"
import type { MiddlewareHandler } from "hono"

/** Company の zValidator 既定レスポンスを型付き例外へ変え、JSON 生成を onError に集約する。 */
export function companyValidationErrorMiddleware(): MiddlewareHandler<HonoEnv> {
  return createMiddleware<HonoEnv>(async (context, next) => {
    await next()

    if (!context.req.path.startsWith("/company/") || context.res.status !== 400) return
    if (!context.res.headers.get("content-type")?.includes("application/json")) return

    const body: unknown = await context.res
      .clone()
      .json()
      .catch(() => null)
    if (typeof body !== "object" || body === null || !("success" in body)) return
    if (body.success !== false || !("error" in body)) return

    throw new CompanyHTTPException({
      status: 400,
      code: "invalid_company_request",
      detail: "Company request is invalid",
      cause: body.error,
    })
  })
}
