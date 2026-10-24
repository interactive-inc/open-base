import type { OrgTreeNode } from "@/lib/api/types/org-types"

/** 部署ツリーを深さ優先で辿り、全ノードの部署コードを平坦な配列にする。 */
export function collectDepartmentCodes(nodes: ReadonlyArray<OrgTreeNode>): ReadonlyArray<string> {
  return nodes.flatMap((node) => [node.code, ...collectDepartmentCodes(node.children)])
}
