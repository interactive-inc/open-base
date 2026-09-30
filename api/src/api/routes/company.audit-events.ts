import { createCompanyAuditEventAdapter } from "@/api/http/audit-events/create-company-audit-event-adapter"
import { AuditTrail } from "@/api/http/audit/audit-trail"
import { throwAuditRouteError } from "@/api/http/audit/throw-audit-route-error"
import { toPublicAuditPage } from "@/api/http/audit/to-public-audit-page"
import { auditListPermission } from "@/api/http/middlewares/audit-list-permission"
import { auditListValidation } from "@/api/http/middlewares/audit-list-validation"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"

// @authorization permission - 権限キーで判定する
export const GET = factory.createHandlers(
  verifyBearer,
  auditListPermission,
  auditListValidation,
  async (c) => {
    const query = c.req.valid("query")
    try {
      const page = await createCompanyAuditEventAdapter(c).search({
        limit: query.limit,
        cursor: query.cursor,
        filters: query.filters,
      })
      const response = toPublicAuditPage(page)
      await new AuditTrail(c).appendSearchSucceeded(
        query.filters,
        query.limit,
        response.data.length,
      )
      return c.json(response, 200)
    } catch (error) {
      throwAuditRouteError(error)
    }
  },
)
