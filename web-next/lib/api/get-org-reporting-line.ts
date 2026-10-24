import { createClient } from "@/lib/api/hc-client"

/**
 * GET /employees/:code/reporting-line を session トークン付きで呼び、
 * 指定従業員から上位へのレポートライン（depth 昇順）を返す。
 */
export async function getOrgReportingLine(employeeCode: string) {
  const client = await createClient()

  const response = await client.company["reporting-lines"][":employeeCode"].$get({
    param: { employeeCode },
  })

  if (response.status >= 400) {
    return new Error("failed to load org reporting line")
  }

  return response.json()
}
