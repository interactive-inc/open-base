import type { CurrentProfile } from "@/components/app/app-shell"
import {
  BackLink,
  formatDate,
  Loaded,
  PageHeader,
  RowsSkeleton,
  TextSkeleton,
} from "@/components/app/data-view"
import { approverText, formatPeriod } from "@/components/app/reviews-model"
import { isReviewId, reviewApi } from "@/components/app/reviews-paths"
import { ReviewSheetCards } from "@/components/app/reviews-status"
import type {
  ReviewApprovalRoute,
  ReviewCycleDetail,
  ReviewPage,
  ReviewSheet,
  ReviewStatus,
} from "@/components/app/reviews-types"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 集計の区切り。差し戻しと却下は、本人が直す段階に数える。 */
const PROGRESS: ReadonlyArray<{ name: string; statuses: ReadonlyArray<ReviewStatus> }> = [
  { name: "目標を設定中", statuses: ["draft", "goals_returned", "goals_rejected"] },
  { name: "目標の承認待ち", statuses: ["goals_pending"] },
  {
    name: "自己評価中",
    statuses: ["goals_approved", "evaluation_returned", "evaluation_rejected"],
  },
  { name: "評価待ち", statuses: ["evaluation_pending"] },
  { name: "確定", statuses: ["finalized"] },
  { name: "取消", statuses: ["cancelled"] },
]

/** 評価期間の一件。期間で固定した尺度と承認経路、期間内のシートの進み具合を見せる。 */
export default function ReviewCyclePage({ email, pathname, id, initial }: DetailProps) {
  const valid = isReviewId(id)
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const cycle = useApiJson<ReviewCycleDetail>(
    reviewApi.cycle(id),
    valid ? initial?.cycle : { kind: "forbidden" },
  )
  const mine = useApiJson<ReviewPage<ReviewSheet>>(
    reviewApi.mySheets(id),
    valid ? initial?.mine : { kind: "forbidden" },
  )
  const all = useApiJson<ReviewPage<ReviewSheet>>(
    reviewApi.allSheets(id),
    valid ? initial?.all : { kind: "forbidden" },
  )

  return (
    <>
      <BackLink href="/reviews/cycles">評価期間の一覧</BackLink>
      <Loaded
        state={cycle}
        fallback={
          <>
            <PageHeader title={<TextSkeleton placeholder="評価期間の名前" label="評価期間" />} />
            <Skeleton className="h-48 w-full" />
          </>
        }
      >
        {(data) => (
          <>
            <PageHeader
              title={data.name}
              description={`${formatPeriod(data.starts_on, data.ends_on)} · 作成 ${formatDate(data.created_at)}`}
            />
            <MySheet mine={mine} />
            <Progress all={all} mine={mine} />
            <Rules cycle={data} />
          </>
        )}
      </Loaded>
    </>
  )
}

function MySheet(props: { mine: ApiJsonState<ReviewPage<ReviewSheet>> }) {
  return (
    <section aria-labelledby="cycle-mine-title" className="flex flex-col gap-4">
      <h2 id="cycle-mine-title" className="text-base font-medium">
        あなたのシート
      </h2>
      <Loaded state={props.mine} fallback={<RowsSkeleton rows={1} />}>
        {(page) =>
          page.data.length === 0 ? (
            <Alert role="status">
              <AlertDescription>
                この期間のシートはまだありません。CLI か MCP で登録すると、ここに出ます。
              </AlertDescription>
            </Alert>
          ) : (
            <ReviewSheetCards
              sheets={page.data.map((sheet) => ({ sheet, viewer: "owner" as const }))}
            />
          )
        }
      </Loaded>
    </section>
  )
}

function Progress(props: {
  all: ApiJsonState<ReviewPage<ReviewSheet>>
  mine: ApiJsonState<ReviewPage<ReviewSheet>>
}) {
  const mineIds = new Set(props.mine.kind === "ok" ? props.mine.data.data.map((s) => s.id) : [])

  return (
    <section aria-labelledby="cycle-progress-title" className="flex flex-col gap-4">
      <h2 id="cycle-progress-title" className="text-base font-medium">
        期間内の進み具合
      </h2>
      {props.all.kind === "forbidden" ? (
        <Alert role="status">
          <AlertDescription>
            全員のシートを見る権限が無いため、進み具合の集計は出せません。
          </AlertDescription>
        </Alert>
      ) : (
        <Loaded state={props.all} fallback={<RowsSkeleton />}>
          {(page) => (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {PROGRESS.map((group) => (
                  <Card key={group.name} size="sm">
                    <CardHeader>
                      <CardDescription>{group.name}</CardDescription>
                      <CardTitle className="text-2xl font-semibold tabular-nums">
                        {page.data.filter((sheet) => group.statuses.includes(sheet.status)).length}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                全 {page.data.length} 件
                {page.next_offset !== null && "（最初の100件だけを数えています）"}
              </p>
              {page.data.length > 0 && (
                <ReviewSheetCards
                  sheets={page.data.map((sheet) => ({
                    sheet,
                    viewer: mineIds.has(sheet.id) ? ("owner" as const) : ("other" as const),
                  }))}
                />
              )}
            </>
          )}
        </Loaded>
      )}
    </section>
  )
}

function Rules({ cycle }: { cycle: ReviewCycleDetail }) {
  const policy = cycle.evaluation_policy

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>この期間の決まり</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">評価の尺度</dt>
          <dd>
            {policy.scale
              .map((entry) =>
                entry.label === String(entry.value)
                  ? entry.label
                  : `${entry.value}（${entry.label}）`,
              )
              .join(" / ")}
          </dd>
          <dt className="text-muted-foreground">区分と配分</dt>
          <dd>
            {policy.sections.map((section) => `${section.name} ${section.weight}%`).join("、")}
          </dd>
          <dt className="text-muted-foreground">目標の承認</dt>
          <dd>
            <RouteSteps route={cycle.goal_approval} />
          </dd>
          <dt className="text-muted-foreground">評価の承認</dt>
          <dd>
            <RouteSteps route={cycle.evaluation_approval} />
          </dd>
        </dl>
      </CardContent>
    </Card>
  )
}

function RouteSteps({ route }: { route: ReviewApprovalRoute }) {
  return (
    <ol className="flex flex-col gap-1">
      {route.workflow.steps.map((step, index) => (
        <li key={step.key}>
          {index + 1}. {step.name}（{approverText(step.approvers)}・戻すときは
          {step.rejection_behavior === "return" ? "差し戻し" : "却下"}）
        </li>
      ))}
    </ol>
  )
}
