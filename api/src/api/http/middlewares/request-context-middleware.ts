import { factory } from "@/api/http/factory"

const externalRequestIdPattern = /^[A-Za-z0-9._:/-]{1,128}$/

function toExternalRequestId(value: string | undefined): string | null {
  return value !== undefined && externalRequestIdPattern.test(value) ? value : null
}

export const requestContextMiddleware = factory.createMiddleware(async (c, next) => {
  const clientHeader = c.req.header("X-Open-Base-Client")
  const clientName = clientHeader === "web" || clientHeader === "cli" ? clientHeader : "api"
  const requestId = crypto.randomUUID()

  c.set("auditContext", {
    requestId,
    clientName,
    clientIp: c.req.header("CF-Connecting-IP") ?? null,
    externalRequestId: toExternalRequestId(c.req.header("X-Request-ID")),
  })

  await next()
  c.header("X-Request-ID", requestId)
})
