/** /org/tree のレスポンス node（再帰構造）。api の OrgTreeNode と同形。 */
type OrgTreeNode = {
  code: string
  name: string
  manager_employee_code: string | null
  member_count: number
  children: ReadonlyArray<OrgTreeNode>
}

export function renderOrgTree(nodes: ReadonlyArray<OrgTreeNode>, depth = 0): string {
  const lines: string[] = []

  for (const node of nodes) {
    const indent = "  ".repeat(depth)

    lines.push(`${indent}${node.code}  ${node.name} (${node.member_count})`)

    if (node.children.length > 0) {
      lines.push(renderOrgTree(node.children, depth + 1))
    }
  }

  return lines.join("\n")
}
