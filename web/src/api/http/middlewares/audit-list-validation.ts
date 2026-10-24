import { AuditListQuery } from "@/api/http/audit/audit-list-query"
import { throwAuditRouteError } from "@/api/http/audit/throw-audit-route-error"
import { factory } from "@/api/http/factory"

type AuditListValidationInput = {
  in: {
    query?: {
      actor_account_id?: string
      action?: string
      target_type?: string
      target_id?: string
      outcome?: "succeeded" | "denied" | "failed"
      from?: string
      to?: string
      limit?: string
      cursor?: string
    }
  }
  out: { query: AuditListQuery }
}

/** Strict list validator placed after authentication and the permission gate. */
export const auditListValidation = factory.createMiddleware<AuditListValidationInput>(
  async (c, next) => {
    try {
      c.req.addValidatedData("query", AuditListQuery.parse(c.req.url))
    } catch (error) {
      throwAuditRouteError(error)
    }
    await next()
  },
)
