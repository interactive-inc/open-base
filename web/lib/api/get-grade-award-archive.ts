import { createClient } from "@/lib/api/hc-client"

/** 保全済みの旧付与原記録を読む。404は未保全であり、旧履歴が空であることを意味しない。 */
export async function getGradeAwardArchive(employeeId: string) {
  const client = await createClient()
  const response = await client.company["grade-award-archives"]["by-employee"][":employeeId"].$get({
    param: { employeeId },
  })
  if (Number(response.status) === 404) return null
  if (response.status >= 400) return new Error("保全済みの等級付与原記録を取得できませんでした")
  return response.json()
}
