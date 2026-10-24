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
  if (response.status >= 400) return new Error("等級の割り当て履歴を読み込めませんでした。")
  const history = await response.json()
  if (
    history.organizationRevision !== props.organizationRevision ||
    history.employeeId !== props.employeeId ||
    history.organizationId !== companyOrganizationId
  )
    return new Error("等級の割り当て履歴が会社情報と一致しません。再読み込みしてください。")
  if (
    history.nextOffset !== null &&
    (history.nextOffset !== props.offset + history.revisions.length ||
      history.nextOffset <= props.offset)
  )
    return new Error("等級の割り当て履歴の続きを読み込めませんでした。")
  return history
}
