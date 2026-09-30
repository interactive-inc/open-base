import { FetchError } from "@/components/fetch-error"
import { getOrgTree } from "@/lib/api/get-org-tree"
import { OrgTreeNodeItem } from "@/app/(app)/company/departments/_components/org-tree-node-item"
import { EmptyState } from "@/components/empty-state"
import { Card } from "@/components/ui/card"

/** /org/tree を認証付きで取得し、ルート部署から再帰的にツリー描画する非同期 RSC。 */
export async function OrgTreeView() {
  const nodes = await getOrgTree()

  if (nodes instanceof Error) {
    return <FetchError message="組織ツリーの取得に失敗しました" />
  }

  if (nodes.length === 0) {
    return <EmptyState title="部署がありません" />
  }

  return (
    <Card className="gap-0">
      <ul className="flex flex-col gap-2 p-4">
        {nodes.map((node) => (
          <OrgTreeNodeItem key={node.code} node={node} depth={0} />
        ))}
      </ul>
    </Card>
  )
}
