import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Timeline,
  TimelineConnector,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from "@/components/ui/timeline"
import type { CurrentProfile } from "@/components/app/app-shell"
import { BackLink, Loaded, PageHeader } from "@/components/app/data-view"
import {
  formatDateTime,
  isOverdue,
  shortId,
  WORK_ACTION,
  WORK_STATE,
} from "@/components/app/operations-format"
import type {
  WorkActor,
  WorkItem,
  WorkItemDetail,
  WorkItemHistory,
} from "@/components/app/operations-types"
import { Facts } from "@/components/app/operations-view"
import { PhaseBar, type Phase } from "@/components/app/phase-bar"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

const STEPS = [
  { key: "offered", name: "受領" },
  { key: "active", name: "作業" },
  { key: "review_pending", name: "確認" },
  { key: "completed", name: "完了" },
] as const

/** 作業の一件。いまの段階と、待っている引き継ぎを上に出す。作業を進める操作はCLIかMCPで行う。 */
export default function WorkItemPage({ email, pathname, id, initial }: DetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const detail = useApiJson<WorkItemDetail>(`/system/work-items/${id}`, initial?.workItem)
  const history = useApiJson<WorkItemHistory>(
    `/system/work-items/${id}/history?limit=50`,
    initial?.history,
  )

  return (
    <>
      <BackLink href="/operations/work-items">作業の一覧</BackLink>
      <Loaded state={detail} fallback={<Skeleton className="h-64 w-full" />}>
        {({ workItem }) => (
          <>
            <PageHeader
              title={workItem.title}
              description={`第 ${workItem.revision} 版 · ${formatDateTime(workItem.recordedAt)} に${WORK_ACTION[workItem.action]}`}
              badges={
                <>
                  {isOverdue(workItem) && <Badge variant="destructive">期限切れ</Badge>}
                  <Badge variant={WORK_STATE[workItem.state].variant}>
                    {WORK_STATE[workItem.state].text}
                  </Badge>
                </>
              }
            />
            {workItem.state !== "cancelled" && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>作業の段階</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PhaseBar phases={phases(workItem)} label="作業の段階" />
                </CardContent>
              </Card>
            )}
            {workItem.handover !== null && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>責任の引き継ぎを待っています</h2>
                  </CardTitle>
                  <div>
                    <Badge variant="secondary">引き継ぎ待ち</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p>引き継ぐ先の人が受けるまで、責任者は今のままです。</p>
                  <Facts
                    items={[
                      ["引き継ぐ先", actor(workItem.handover.to)],
                      ["依頼した人", actor(workItem.handover.requestedBy)],
                      ["依頼した日時", formatDateTime(workItem.handover.requestedAt)],
                      ["理由", workItem.handover.reason],
                    ]}
                  />
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>依頼の内容</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Facts
                  items={[
                    ["担当", actor(workItem.assignee)],
                    ["責任者", actor(workItem.accountable)],
                    ["依頼した人", actor(workItem.createdBy)],
                    ["期限", workItem.dueAt === null ? null : formatDateTime(workItem.dueAt)],
                    ["依頼した日時", formatDateTime(workItem.createdAt)],
                  ]}
                />
                <Separator />
                <Text label="手順" value={workItem.instructions} />
                <Text label="受け入れの条件" value={workItem.acceptanceCriteria} />
              </CardContent>
            </Card>
            {workItem.result !== null && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h2>提出された成果</h2>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <p className="whitespace-pre-wrap">{workItem.result.summary}</p>
                  <Facts
                    items={[
                      ["提出した人", actor(workItem.result.submittedBy)],
                      ["提出した日時", formatDateTime(workItem.result.submittedAt)],
                      ["証拠の添付", `${workItem.result.evidence.length} 件`],
                    ]}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}
      </Loaded>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>これまでの経緯</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loaded state={history} fallback={<Skeleton className="h-24 w-full" />}>
            {(data) => (
              <Timeline aria-label="作業の経緯">
                {data.revisions.map((revision) => (
                  <TimelineItem key={revision.revision}>
                    <TimelineMarker />
                    <TimelineConnector />
                    <TimelineTitle>{WORK_ACTION[revision.action]}</TimelineTitle>
                    <TimelineTime dateTime={revision.recordedAt}>
                      {formatDateTime(revision.recordedAt)} · 第 {revision.revision} 版 ·{" "}
                      {actor(revision.actor)}
                    </TimelineTime>
                    <p className="col-start-2 whitespace-pre-wrap">{revision.reason}</p>
                  </TimelineItem>
                ))}
              </Timeline>
            )}
          </Loaded>
        </CardContent>
      </Card>
    </>
  )
}

function phases(item: WorkItem): Phase[] {
  const current = STEPS.findIndex((step) => step.key === item.state)
  return STEPS.map((step, index) => ({
    key: step.key,
    name: step.name,
    status:
      item.state === "completed" || index < current
        ? "approved"
        : index === current
          ? "pending"
          : "waiting",
  }))
}

function actor(value: WorkActor): string {
  return `${value.kind === "agent" ? "エージェント" : "人"} ${shortId(value.accountId)}`
}

function Text({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-medium">{label}</h3>
      <p className="whitespace-pre-wrap">{value}</p>
    </div>
  )
}
