import { ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CurrentProfile } from "@/components/app/app-shell"
import { Loaded, PageHeader } from "@/components/app/data-view"
import {
  DELIVERY_STATUS,
  formatDateTime,
  shortId,
  type StatusLabel,
} from "@/components/app/operations-format"
import type {
  BatchJob,
  BatchJobPage,
  DeadLetter,
  DeadLetterList,
  Delivery,
  DeliveryList,
} from "@/components/app/operations-types"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type DeliveriesProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

const SOURCE: Readonly<Record<DeadLetter["source_type"], string>> = {
  job: "ジョブ",
  outbox: "外への送信",
  inbox: "外からの受信",
}

const BATCH: Readonly<Record<BatchJob["status"], StatusLabel>> = {
  failed: { text: "失敗", variant: "destructive" },
  running: { text: "実行中", variant: "secondary" },
  completed: { text: "完了", variant: "outline" },
}

/** 配信と再試行。止まって再投入を待つものを一番上に出し、その下に配信とバッチの状態を並べる。流し直しはCLIかMCPで行う。 */
export default function Deliveries({ email, pathname, initial }: DeliveriesProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const deadLetters = useApiJson<DeadLetterList>("/system/dead-letters", initial?.deadLetters)
  const jobs = useApiJson<DeliveryList>("/system/deliveries?kind=job", initial?.jobs)
  const outbox = useApiJson<DeliveryList>("/system/deliveries?kind=outbox", initial?.outbox)
  const batchJobs = useApiJson<BatchJobPage>("/system/batch-jobs?limit=50", initial?.batchJobs)

  return (
    <>
      <PageHeader
        title="配信と再試行"
        description="止まった処理と、配信とバッチの状態を確かめます。"
      />
      <Loaded state={deadLetters} fallback={<Skeleton className="h-40 w-full rounded-2xl" />}>
        {(data) => <DeadLetters items={data.dead_letters} />}
      </Loaded>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>配信の状態</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>止まっているもの、期限が切れたものから順に並べます。</p>
          <Tabs defaultValue="job" className="flex flex-col gap-4">
            <TabsList aria-label="配信の種類">
              <TabsTrigger value="job">ジョブ{stoppedLabel(jobs)}</TabsTrigger>
              <TabsTrigger value="outbox">外への送信{stoppedLabel(outbox)}</TabsTrigger>
            </TabsList>
            <TabsContent value="job">
              <Loaded state={jobs} fallback={<Skeleton className="h-40 w-full" />}>
                {(data) => <DeliveryRows items={data.deliveries} />}
              </Loaded>
            </TabsContent>
            <TabsContent value="outbox">
              <Loaded state={outbox} fallback={<Skeleton className="h-40 w-full" />}>
                {(data) => <DeliveryRows items={data.deliveries} />}
              </Loaded>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div id="batch-jobs">
        <Loaded state={batchJobs} fallback={<Skeleton className="h-40 w-full rounded-2xl" />}>
          {(data) => <BatchJobs jobs={data.data} />}
        </Loaded>
      </div>
    </>
  )
}

function stoppedLabel(state: { kind: string; data?: DeliveryList }): string {
  if (state.kind !== "ok" || state.data === undefined) return ""
  const count = state.data.deliveries.filter((item) => item.status === "dead_letter").length
  return count > 0 ? `（止まっている ${count} 件）` : ""
}

function DeadLetters(props: { items: ReadonlyArray<DeadLetter> }) {
  const waiting = props.items
    .filter((item) => item.requeued_job_id === null)
    .toSorted((left, right) => left.recorded_at.localeCompare(right.recorded_at))
  const requeued = props.items.filter((item) => item.requeued_job_id !== null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>止まって再投入を待つもの</h2>
        </CardTitle>
        {waiting.length > 0 && (
          <div>
            <Badge variant="destructive">止まっている {waiting.length} 件</Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p>
          {waiting.length === 0
            ? "止まっている処理はありません。"
            : `${waiting.length} 件が止まっています。古いものから並べています。原因を直してから、CLI か MCP で流し直してください。`}
        </p>
        {waiting.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>種類</TableHead>
                <TableHead>理由</TableHead>
                <TableHead>止まった日時</TableHead>
                <TableHead className="text-right">試した回数</TableHead>
                <TableHead>元</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {waiting.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{SOURCE[item.source_type]}</TableCell>
                  <TableCell className="font-mono">{item.reason_code}</TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(item.recorded_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{item.attempt} 回</TableCell>
                  <TableCell className="font-mono">{shortId(item.source_id)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {requeued.length > 0 && (
          <Collapsible className="flex flex-col gap-2">
            <CollapsibleTrigger
              render={<Button variant="secondary" size="sm" className="group self-start" />}
            >
              流し直したもの（{requeued.length} 件）
              <ChevronDown
                data-icon="inline-end"
                className="transition-transform group-data-open:rotate-180"
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ul className="flex flex-col gap-2 rounded-xl bg-muted p-4">
                {requeued.map((item) => (
                  <li key={item.id}>
                    {SOURCE[item.source_type]} <span className="font-mono">{item.reason_code}</span>{" "}
                    ·{" "}
                    <span className="text-muted-foreground">
                      {item.requeued_at === null ? "" : formatDateTime(item.requeued_at)} に流し直し
                    </span>
                  </li>
                ))}
              </ul>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  )
}

/** 処理中のまま期限が切れたもの。処理していた側が止まった可能性がある。 */
function leaseExpired(item: Delivery, now: number): boolean {
  return (
    item.status === "leased" &&
    item.lease_expires_at !== null &&
    Date.parse(item.lease_expires_at) <= now
  )
}

const ORDER: Readonly<Record<Delivery["status"], number>> = {
  dead_letter: 0,
  leased: 2,
  queued: 3,
  succeeded: 4,
}

function DeliveryRows(props: { items: ReadonlyArray<Delivery> }) {
  const now = Date.now()
  if (props.items.length === 0) {
    return <p>配信の記録はまだありません。</p>
  }
  const rank = (item: Delivery) => (leaseExpired(item, now) ? 1 : ORDER[item.status])
  const items = props.items.toSorted(
    (left, right) => rank(left) - rank(right) || right.updated_at.localeCompare(left.updated_at),
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>操作</TableHead>
          <TableHead>状態</TableHead>
          <TableHead className="text-right">回数</TableHead>
          <TableHead>更新した日時</TableHead>
          <TableHead>エラー</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const status = DELIVERY_STATUS[item.status]
          return (
            <TableRow key={item.id}>
              <TableCell className="font-mono">{item.operation_key}</TableCell>
              <TableCell>
                {leaseExpired(item, now) ? (
                  <Badge variant="destructive">処理が止まった</Badge>
                ) : (
                  <Badge variant={status.variant}>{status.text}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {item.attempt} / {item.max_attempts} 回
              </TableCell>
              <TableCell className="tabular-nums">{formatDateTime(item.updated_at)}</TableCell>
              <TableCell className="font-mono">{item.last_error_code ?? "なし"}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function BatchJobs(props: { jobs: ReadonlyArray<BatchJob> }) {
  const failed = props.jobs.filter((job) => job.status === "failed").length
  const jobs = props.jobs.toSorted(
    (left, right) =>
      Number(right.status === "failed") - Number(left.status === "failed") ||
      (right.started_at ?? "").localeCompare(left.started_at ?? ""),
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>バッチの実行</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p>
          {failed > 0
            ? `失敗したバッチが ${failed} 件あります。失敗したものから並べています。`
            : `直近 ${props.jobs.length} 件の実行です。`}
        </p>
        {jobs.length === 0 ? (
          <p>バッチの実行はまだありません。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>開始</TableHead>
                <TableHead>終了</TableHead>
                <TableHead>メッセージ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono">{job.name}</TableCell>
                  <TableCell>
                    <Badge variant={BATCH[job.status].variant}>{BATCH[job.status].text}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {job.started_at === null ? "未開始" : formatDateTime(job.started_at)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {job.finished_at === null ? "なし" : formatDateTime(job.finished_at)}
                  </TableCell>
                  <TableCell className="min-w-64 whitespace-normal">
                    {job.message ?? "なし"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
