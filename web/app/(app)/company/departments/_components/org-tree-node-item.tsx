import Link from "next/link"
import { StatusLabel } from "@/components/status-label"
import type { OrgTreeNode } from "@/lib/api/types/org-types"

type Props = {
  node: OrgTreeNode
  depth: number
}

/**
 * 組織ツリーの 1 ノードを階層インデント付きで描画し、子ノードを再帰的に並べる。
 * 部署名をクリックするとその部署のハブ（概要）へ遷移する。
 */
export function OrgTreeNodeItem(props: Props) {
  const indentStyle = { paddingInlineStart: `${props.depth * 1.5}rem` }

  return (
    <li className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2 rounded-md py-2 hover:bg-muted/50"
        style={indentStyle}
      >
        <Link href={`/teams/${props.node.code}`} className="text-sm font-medium hover:underline">
          {props.node.name}
        </Link>

        <span className="text-xs text-muted-foreground">{props.node.code}</span>

        <StatusLabel>{props.node.member_count}名</StatusLabel>

        {props.node.manager_employee_code !== null && (
          <Link
            href={`/company/employees/${props.node.manager_employee_code}/reporting-line`}
            className="text-xs text-muted-foreground hover:underline"
          >
            長: {props.node.manager_employee_code}
          </Link>
        )}
      </div>

      {props.node.children.length > 0 && (
        <ul className="flex flex-col gap-2">
          {props.node.children.map((child) => (
            <OrgTreeNodeItem key={child.code} node={child} depth={props.depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
