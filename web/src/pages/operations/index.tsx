import { Link } from "@void/react"
import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { CurrentProfile } from "@/components/app/app-shell"
import { PageHeader, TextSkeleton } from "@/components/app/data-view"
import type {
  BatchJobPage,
  DeadLetterList,
  DeliveryList,
  FeatureAvailability,
  Health,
  WorkItemPage,
} from "@/components/app/operations-types"
import { needsAttention } from "@/components/app/operations-format"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type OverviewProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

const AREAS = [
  {
    href: "/operations/audit",
    title: "監査の記録",
    description: "誰がいつ何をしたかを絞り込んで確かめます。",
  },
  {
    href: "/operations/work-items",
    title: "作業の依頼",
    description: "依頼した作業の受領、成果の確認、引き継ぎの進み具合を見ます。",
  },
  {
    href: "/operations/deliveries",
    title: "配信と再試行",
    description: "止まった配信やバッチを確かめます。",
  },
  {
    href: "/operations/connectors",
    title: "外部接続",
    description: "外部とのつなぎ先と、やり取りの記録を見ます。",
  },
] as const

/** 運用と監査の入口。いま手当てが要るものを一番上に出す。 */
export default function OperationsOverview({ email, pathname, initial }: OverviewProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const health = useApiJson<Health>("/system/health", initial?.health)
  const deadLetters = useApiJson<DeadLetterList>("/system/dead-letters", initial?.deadLetters)
  const stoppedJobs = useApiJson<DeliveryList>(
    "/system/deliveries?kind=job&status=dead_letter",
    initial?.stoppedJobs,
  )
  const stoppedOutbox = useApiJson<DeliveryList>(
    "/system/deliveries?kind=outbox&status=dead_letter",
    initial?.stoppedOutbox,
  )
  const batchJobs = useApiJson<BatchJobPage>("/system/batch-jobs?limit=50", initial?.batchJobs)
  const workItems = useApiJson<WorkItemPage>("/system/work-items?limit=50", initial?.workItems)
  const features = useApiJson<FeatureAvailability>("/company/features", initial?.features)

  const counts = [
    count(
      deadLetters,
      (data) => data.dead_letters.filter((item) => item.requeued_job_id === null).length,
    ),
    count(batchJobs, (data) => data.data.filter((job) => job.status === "failed").length),
    count(workItems, (data) => data.workItems.filter(needsAttention).length),
  ]
  const stopped =
    stoppedJobs.kind === "ok" && stoppedOutbox.kind === "ok"
      ? stoppedJobs.data.deliveries.length + stoppedOutbox.data.deliveries.length
      : null
  const attention =
    health.kind === "error" ||
    (stopped !== null && stopped > 0) ||
    counts.some((value) => value !== null && value > 0)

  const rows: ReadonlyArray<{ label: string; href: string | null; value: ReactNode }> = [
    {
      label: "APIの応答",
      href: null,
      value:
        health.kind === "loading" ? (
          <TextSkeleton placeholder="確認中" label="確認中" />
        ) : health.kind === "ok" ? (
          <Badge variant="outline">応答あり</Badge>
        ) : (
          <Badge variant="destructive">応答がありません</Badge>
        ),
    },
    {
      label: "再投入を待つ、止まった処理",
      href: "/operations/deliveries",
      value: <Count state={deadLetters} value={counts[0] ?? null} />,
    },
    {
      label: "止まった配信",
      href: "/operations/deliveries",
      value: (
        <Count state={stoppedJobs.kind === "ok" ? stoppedOutbox : stoppedJobs} value={stopped} />
      ),
    },
    {
      label: "失敗したバッチ",
      href: "/operations/deliveries#batch-jobs",
      value: <Count state={batchJobs} value={counts[1] ?? null} />,
    },
    {
      label: "受領・確認・引き継ぎを待つ作業",
      href: "/operations/work-items",
      value: <Count state={workItems} value={counts[2] ?? null} />,
    },
  ]

  return (
    <>
      <PageHeader
        title="運用と監査"
        description="仕組みの状態と、手当てが要るものをまとめて見ます。"
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>いま手当てが要るもの</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>
            {attention
              ? "止まっているものがあります。上から順に確かめてください。"
              : "止まっているものはありません。"}
          </p>
          <ul className="flex flex-col">
            {rows.map((row, index) => (
              <li key={row.label}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {row.href === null ? (
                    <span>{row.label}</span>
                  ) : (
                    <Link href={row.href} className="underline underline-offset-4">
                      {row.label}
                    </Link>
                  )}
                  {row.value}
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {features.kind === "ok" && features.data.disabled_features.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>止めている機能</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p>この配備で使えないようにしている機能です。</p>
            <ul className="flex flex-wrap gap-2">
              {features.data.disabled_features.map((key) => (
                <li key={key}>
                  <Badge variant="secondary">{key}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <nav aria-label="運用と監査の機能">
        <ul className="grid gap-4 sm:grid-cols-2">
          {AREAS.map((area) => (
            <li key={area.href} className="flex">
              <Card className="flex-1">
                <CardHeader>
                  <CardTitle>
                    <h2>
                      <Link href={area.href} className="underline-offset-4 hover:underline">
                        {area.title}
                      </Link>
                    </h2>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{area.description}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}

function count<T>(state: ApiJsonState<T>, pick: (data: T) => number): number | null {
  return state.kind === "ok" ? pick(state.data) : null
}

function Count(props: { state: ApiJsonState<unknown>; value: number | null }) {
  if (props.state.kind === "loading") return <TextSkeleton placeholder="0 件" label="読み込み中" />
  if (props.state.kind === "forbidden")
    return <span className="text-muted-foreground">見る権限がありません</span>
  if (props.state.kind === "error" || props.value === null)
    return <span className="text-muted-foreground">読み込めませんでした</span>
  return props.value > 0 ? (
    <Badge variant="destructive">{props.value} 件</Badge>
  ) : (
    <span className="text-muted-foreground">なし</span>
  )
}
