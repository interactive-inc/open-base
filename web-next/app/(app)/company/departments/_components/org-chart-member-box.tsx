import Link from "next/link"
import { cn } from "@/lib/utils"
import type { OrgMember } from "@/lib/api/types/org-types"

type Props = {
  member: OrgMember
}

/**
 * 組織図で従業員を 1 名分の小さなボックスとして描画する。
 * マネージャーは枠線・氏名の色だけで区別し、ラベルの繰り返しは避ける。
 */
export function OrgChartMemberBox(props: Props) {
  return (
    <Link
      href={`/company/employees/${props.member.employee_code}/reporting-line`}
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-2 text-xs hover:bg-muted/50",
        props.member.is_manager ? "border-primary/60 bg-primary/5" : "bg-card",
      )}
    >
      <span className={cn("font-medium", props.member.is_manager && "text-primary")}>
        {props.member.employee_name}
      </span>

      <span className="text-muted-foreground">{props.member.position ?? "-"}</span>
    </Link>
  )
}
