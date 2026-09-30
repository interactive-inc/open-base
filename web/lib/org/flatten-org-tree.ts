type OrgTreeNode = {
  code: string
  name: string
  children: ReadonlyArray<OrgTreeNode>
}

export type FlatDepartment = {
  code: string
  name: string
  depth: number
}

/**
 * 組織ツリーを表示順(親 → 子の深さ優先)のフラット配列へ変換する。
 * サイドバーの部署一覧など、ネストを持てない一覧表示に使う。
 */
export function flattenOrgTree(
  nodes: ReadonlyArray<OrgTreeNode>,
  depth = 0,
): Array<FlatDepartment> {
  const flattened: Array<FlatDepartment> = []

  for (const node of nodes) {
    flattened.push({ code: node.code, name: node.name, depth })

    flattened.push(...flattenOrgTree(node.children, depth + 1))
  }

  return flattened
}
