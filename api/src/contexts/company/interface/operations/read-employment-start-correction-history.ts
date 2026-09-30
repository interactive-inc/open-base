import { readCompanyStartCorrectionHistory } from "@/contexts/company/interface/operations/read-company-start-correction-history"
import type { CompanyStartCorrectionHistory } from "@/contexts/company/interface/operations/read-company-start-correction-history"

/** 同じ会社版に固定して雇用の全revisionを取得する。 */
export async function readEmploymentStartCorrectionHistory(
  input: Readonly<{
    database: D1Database
    organizationId: string
    employmentId: string
    throughRevision?: number
  }>,
): Promise<CompanyStartCorrectionHistory | null | Error> {
  return readCompanyStartCorrectionHistory({
    ...input,
    type: "employment",
    resourceId: input.employmentId,
  })
}
