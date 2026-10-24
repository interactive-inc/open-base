import {
  createCompanyAuditEventAdapter,
  type CompanyAuditExportRows,
} from "@/api/http/audit-events/create-company-audit-event-adapter"
import { AuditTrail } from "@/api/http/audit/audit-trail"
import { throwAuditRouteError } from "@/api/http/audit/throw-audit-route-error"
import { auditExportPermission } from "@/api/http/middlewares/audit-export-permission"
import { auditExportValidation } from "@/api/http/middlewares/audit-export-validation"
import { verifyBearer } from "@/api/http/verify-bearer"
import { toAuditCsv } from "@/api/http/audit/to-audit-csv"
import { PayloadTooLargeError } from "@/lib/errors"
import { CompanyPayloadTooLargeError } from "@/contexts/company/domain/errors"
import { factory } from "@/api/http/factory"

// @authorization permission - 権限キーで判定する
export const POST = factory.createHandlers(
  verifyBearer,
  auditExportPermission,
  auditExportValidation,
  async (c) => {
    const range = c.req.valid("json")
    let rows: CompanyAuditExportRows
    let csv: string
    try {
      rows = await createCompanyAuditEventAdapter(c).export({ filters: range.filters })
      csv = toAuditCsv(rows)
    } catch (error) {
      // 容量超過はCompanyの監査台帳（export）とAPI rootのCSV整形（toAuditCsv）の両方から届く。
      if (error instanceof PayloadTooLargeError || error instanceof CompanyPayloadTooLargeError) {
        try {
          await new AuditTrail(c).appendExportTooLarge(range.filters)
        } catch (auditError) {
          throwAuditRouteError(auditError)
        }
      }
      throwAuditRouteError(error)
    }

    try {
      await new AuditTrail(c).appendExportSucceeded(range.filters, rows.length)
    } catch (error) {
      throwAuditRouteError(error)
    }

    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="audit-events.csv"',
    })
  },
)
