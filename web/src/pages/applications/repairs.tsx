import { WrenchIcon } from "lucide-react"
import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { WorkflowRepair, WorkflowRepairList } from "@/components/app/application-types"
import {
  BackLink,
  daysSince,
  EmptyState,
  formatDate,
  Loaded,
  PageHeader,
  RowsSkeleton,
} from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Props } from "./repairs.server"

type RepairsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

const REASON_TEXT: Readonly<Record<WorkflowRepair["reason"], string>> = {
  inactive_candidates: "承認できる人が足りません",
  snapshot_missing: "承認者の記録がありません",
}

/** 承認できる人がいなくなって止まった申請。担当の付け替えはCLIかMCPで行う。 */
export default function WorkflowRepairs({ email, pathname, initial }: RepairsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const repairs = useApiJson<WorkflowRepairList>(
    "/company/application-requests/workflow-repairs?limit=100",
    initial?.repairs,
  )

  return (
    <>
      <BackLink href="/applications">申請</BackLink>
      <PageHeader
        title="止まった申請の修復"
        description="退職や休職で承認できる人がいなくなり、進まなくなった申請です。CLI か MCP で担当を付け替えると先へ進みます。"
      />
      <Loaded state={repairs} fallback={<RowsSkeleton />}>
        {(list) =>
          list.data.length === 0 ? (
            <EmptyState
              icon={WrenchIcon}
              title="止まっている申請はありません"
              description="承認できる人がいなくなった申請があると、ここに出ます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {list.data.map((repair) => (
                <RepairRow
                  key={`${repair.id}-${repair.step_key}-${repair.round}`}
                  repair={repair}
                />
              ))}
            </ul>
          )
        }
      </Loaded>
    </>
  )
}

function RepairRow(props: { repair: WorkflowRepair }) {
  const { repair } = props
  const days = daysSince(repair.started_at)

  return (
    <li>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>
              <Link href={`/applications/${repair.id}`} className="hover:underline">
                {repair.template_name}（申請番号 {repair.id}）
              </Link>
            </h2>
          </CardTitle>
          <CardDescription>
            {repair.applicant_name ?? "申請者不明"} · 段階 {repair.step_key}（{repair.round}
            回目） · {formatDate(repair.started_at)} から
            {days > 0 ? ` ${days}日止まっている` : ""}
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Badge variant="destructive">{REASON_TEXT[repair.reason]}</Badge>
          </div>
        </CardHeader>
      </Card>
    </li>
  )
}
