import { factory } from "@/api/http/factory"

function isAuditResponsePath(path: string): boolean {
  return (
    path === "/company/audit-events" ||
    path.startsWith("/company/audit-events/") ||
    path === "/company/audit-event-exports"
  )
}

/** Overwrites cache policy after all inner middleware, including handled error responses. */
export const auditNoStore = factory.createMiddleware(async (c, next) => {
  await next()
  if (isAuditResponsePath(c.req.path)) c.header("Cache-Control", "no-store")
})
