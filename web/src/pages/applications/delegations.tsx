import { UserCheckIcon } from "lucide-react"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { Delegation, DelegationList, TemplateList } from "@/components/app/application-types"
import {
  BackLink,
  EmptyState,
  formatDateTime,
  Loaded,
  PageHeader,
  RowsSkeleton,
} from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Props } from "./delegations.server"

type DelegationsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

type DelegationPhase = "cancelled" | "ended" | "active" | "scheduled"

const PHASE: Readonly<Record<DelegationPhase, { text: string; variant: "secondary" | "outline" }>> =
  {
    active: { text: "代理中", variant: "secondary" },
    scheduled: { text: "これから", variant: "outline" },
    ended: { text: "終了", variant: "outline" },
    cancelled: { text: "取り消し", variant: "outline" },
  }

function phaseOf(delegation: Delegation, now: Date): DelegationPhase {
  if (delegation.cancelled_at !== null) return "cancelled"
  if (new Date(delegation.ends_at) <= now) return "ended"
  if (new Date(delegation.starts_at) <= now) return "active"
  return "scheduled"
}

/** 承認の代理。自分が任せた代理と、任された代理を見る。頼む・取り消すはCLIかMCPで行う。 */
export default function ApprovalDelegations({ email, pathname, initial }: DelegationsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const delegations = useApiJson<DelegationList>(
    "/company/approval-delegations",
    initial?.delegations,
  )
  const templates = useApiJson<TemplateList>(
    "/company/application-templates?limit=100",
    initial?.templates,
  )
  const templateNames = new Map(
    templates.kind === "ok" ? templates.data.data.map((item) => [item.code, item.name]) : [],
  )

  return (
    <>
      <BackLink href="/applications">申請</BackLink>
      <PageHeader
        title="承認の代理"
        description="不在の間、あなたの判断を別の従業員に任せた代理と、任された代理です。"
      />

      <Loaded state={delegations} fallback={<RowsSkeleton />}>
        {(list) =>
          list.data.length === 0 ? (
            <EmptyState
              icon={UserCheckIcon}
              title="代理はまだありません"
              description="CLI か MCP で代理を頼むと、ここに出ます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {list.data.map((delegation) => (
                <DelegationRow
                  key={delegation.id}
                  delegation={delegation}
                  templateName={
                    delegation.template_code === null
                      ? "すべての申請"
                      : (templateNames.get(delegation.template_code) ?? delegation.template_code)
                  }
                />
              ))}
            </ul>
          )
        }
      </Loaded>
    </>
  )
}

function DelegationRow(props: { delegation: Delegation; templateName: string }) {
  const { delegation } = props
  const phase = PHASE[phaseOf(delegation, new Date())]

  return (
    <li>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>
              {delegation.delegator?.name ?? "不明な従業員"} から{" "}
              {delegation.delegate?.name ?? "不明な従業員"} へ
            </h2>
          </CardTitle>
          <CardDescription>
            {props.templateName} · {formatDateTime(delegation.starts_at)} 〜{" "}
            {formatDateTime(delegation.ends_at)}
          </CardDescription>
          <div className="flex flex-wrap gap-2">
            <Badge variant={phase.variant}>{phase.text}</Badge>
          </div>
        </CardHeader>
      </Card>
    </li>
  )
}
