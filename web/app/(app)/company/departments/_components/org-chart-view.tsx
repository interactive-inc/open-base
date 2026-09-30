import { FetchError } from "@/components/fetch-error"
import { getOrgTree } from "@/lib/api/get-org-tree"
import { getOrgDepartmentMembers } from "@/lib/api/get-org-department-members"
import { OrgChartNode } from "@/app/(app)/company/departments/_components/org-chart-node"
import { collectDepartmentCodes } from "@/app/(app)/company/departments/_lib/collect-department-codes"
import { toMembersByCode } from "@/app/(app)/company/departments/_lib/to-members-by-code"
import { EmptyState } from "@/components/empty-state"
import { Card } from "@/components/ui/card"

/**
 * /org/tree と各部署のメンバー一覧を組み合わせ、部署→マネージャー→従業員を縦型ボックスで描画する非同期 RSC。
 */
export async function OrgChartView() {
  const nodes = await getOrgTree()

  if (nodes instanceof Error) {
    return <FetchError message="組織ツリーの取得に失敗しました" />
  }

  if (nodes.length === 0) {
    return <EmptyState title="部署がありません" />
  }

  const codes = collectDepartmentCodes(nodes)
  const memberLists = await Promise.all(codes.map((code) => getOrgDepartmentMembers(code)))
  const membersByCode = toMembersByCode(codes, memberLists)

  return (
    <Card className="gap-0">
      <ul className="flex flex-col gap-8 p-8">
        {nodes.map((node) => (
          <OrgChartNode key={node.code} node={node} membersByCode={membersByCode} />
        ))}
      </ul>
    </Card>
  )
}
