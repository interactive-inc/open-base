import { createClient } from "@/lib/api/hc-client"
import { companyOrganizationId } from "@/lib/api/company-organization-id"

type Props = { employeeId: string; organizationRevision: number; offset: number }

/** 同じ会社版に固定した等級割当の改訂を一ページ取得する。 */
export async function getGradeAssignmentHistory(props: Props) {
  const client = await createClient()
  const response = await client.company["grade-assignment-history"].$get({
    header: { "x-company-organization-id": companyOrganizationId },
    query: {
      employee_id: props.employeeId,
      organization_revision: String(props.organizationRevision),
      offset: String(props.offset),
    },
  })
  if (response.status >= 400) return new Error("等級割当の履歴を取得できませんでした")
  const history = await response.json()
  if (
    history.organizationRevision !== props.organizationRevision ||
    history.employeeId !== props.employeeId ||
    history.organizationId !== companyOrganizationId
  )
    return new Error("確認した会社版と等級割当の履歴が一致しません")
  if (
    history.nextOffset !== null &&
    (history.nextOffset !== props.offset + history.revisions.length ||
      history.nextOffset <= props.offset)
  )
    return new Error("等級割当の履歴の続きが不正です")
  return history
}
