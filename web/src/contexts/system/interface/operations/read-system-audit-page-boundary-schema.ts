import { SystemAuditPageBoundaryValue } from "@system/domain/values/audit/system-audit-page-boundary.value"
import { z } from "zod"

const systemAuditPageBoundarySchema = z
  .string()
  .max(64)
  .transform((text, context) => {
    const boundary = SystemAuditPageBoundaryValue.parse(text)

    if (boundary instanceof Error) {
      context.addIssue({ code: "custom", message: "boundary is invalid" })
      return z.NEVER
    }

    return boundary
  })

export type SystemAuditPageBoundary = z.output<typeof systemAuditPageBoundarySchema>

/** 監査一覧の続きのページに渡す境界を、要求の検証で読み取るschemaを読む。 */
export function readSystemAuditPageBoundarySchema() {
  return systemAuditPageBoundarySchema
}
