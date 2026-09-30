import Link from "next/link"
import { OrgChartMemberBox } from "@/app/(app)/company/departments/_components/org-chart-member-box"
import type { OrgMember, OrgTreeNode } from "@/lib/api/types/org-types"

type Props = {
  node: OrgTreeNode
  membersByCode: ReadonlyMap<string, ReadonlyArray<OrgMember>>
}

/**
 * 組織図の 1 部署をツリーの 1 ノードとして描画する。部署ボックスの下に、マネージャー・従業員の行と
 * 子部署の一覧を 1 本の縦線でまとめてぶら下げ、子部署は再帰的にさらに右へインデントする。
 */
export function OrgChartNode(props: Props) {
  const members = props.membersByCode.get(props.node.code) ?? []
  const manager = members.find((member) => member.is_manager) ?? null
  const otherMembers = members.filter((member) => !member.is_manager)
  const hasChildren = members.length > 0 || props.node.children.length > 0

  return (
    <li className="flex flex-col gap-4">
      <Link
        href={`/teams/${props.node.code}`}
        className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        {props.node.name}

        <span className="text-xs opacity-80">{props.node.code}</span>
      </Link>

      {hasChildren && (
        <div className="ml-4 flex flex-col gap-4 border-l-2 border-border py-2 pl-4">
          {members.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {manager !== null && <OrgChartMemberBox member={manager} />}

              {otherMembers.map((member) => (
                <OrgChartMemberBox key={member.employee_code} member={member} />
              ))}
            </div>
          )}

          {props.node.children.length > 0 && (
            <ul className="flex flex-col gap-4">
              {props.node.children.map((child) => (
                <OrgChartNode key={child.code} node={child} membersByCode={props.membersByCode} />
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}
