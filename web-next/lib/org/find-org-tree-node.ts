import type { OrgTreeNode } from "@/lib/api/types/org-types"

/** 部署ツリーを深さ優先で辿り、code に一致するノードを返す。見つからなければ null。 */
export function findOrgTreeNode(
  nodes: ReadonlyArray<OrgTreeNode>,
  code: string,
): OrgTreeNode | null {
  for (const node of nodes) {
    if (node.code === code) {
      return node
    }

    const found = findOrgTreeNode(node.children, code)

    if (found !== null) {
      return found
    }
  }

  return null
}
