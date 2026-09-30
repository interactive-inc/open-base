import { getOrgDepartment } from "@/lib/api/get-org-department"
import { getOrgTree } from "@/lib/api/get-org-tree"
import { findOrgTreeNode } from "@/lib/org/find-org-tree-node"

type Props = {
  team: string
}

/**
 * 部署ハブ配下の各ページで見出しの下に部署名を出す小さな表示。
 * PageHeader のタイトルはサイドバーの label 固定にするため、
 * 「どの部署を見ているか」はここで別要素として補う。
 */
export async function DepartmentName(props: Props) {
  const [department, tree] = await Promise.all([getOrgDepartment(props.team), getOrgTree()])

  if (department instanceof Error) {
    return null
  }

  const node = tree instanceof Error ? null : findOrgTreeNode(tree, props.team)

  return <p className="text-sm text-muted-foreground">{node === null ? props.team : node.name}</p>
}
