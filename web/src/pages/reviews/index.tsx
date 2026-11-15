import { Gavel, Target } from "lucide-react"
import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { formatPeriod } from "@/components/app/reviews-model"
import { reviewApi } from "@/components/app/reviews-paths"
import { ReviewSheetCards } from "@/components/app/reviews-status"
import type {
  ReviewCycle,
  ReviewInboxSheet,
  ReviewPage,
  ReviewSheet,
} from "@/components/app/reviews-types"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { Props } from "./index.server"

type ReviewsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 自分の評価シートと、自分の判断を待っているシートを評価期間ごとに並べる。 */
export default function Reviews({ email, pathname, initial }: ReviewsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const cycles = useApiJson<ReviewPage<ReviewCycle>>(reviewApi.cycles, initial?.cycles)
  const mine = useApiJson<ReviewPage<ReviewSheet>>(reviewApi.mySheets(), initial?.mine)
  const inbox = useApiJson<ReviewPage<ReviewInboxSheet>>(reviewApi.inbox(), initial?.inbox)
  // 判断待ちも読み終わってから並べる。先に出した行が後から下へずれないようにする。
  const sheets: ApiJsonState<ReviewPage<ReviewSheet>> =
    inbox.kind === "loading" ? { kind: "loading" } : mine

  return (
    <>
      <PageHeader
        title="評価"
        description="あなたの評価シートと、あなたの判断を待っているシートです。"
      />

      <Loaded state={sheets} fallback={<RowsSkeleton />}>
        {(list) => <SheetGroups mine={list.data} inbox={inbox} cycles={cycles} />}
      </Loaded>
    </>
  )
}

type Row = { sheet: ReviewSheet; viewer: "owner" | "evaluator" }

function SheetGroups(props: {
  mine: ReadonlyArray<ReviewSheet>
  inbox: ApiJsonState<ReviewPage<ReviewInboxSheet>>
  cycles: ApiJsonState<ReviewPage<ReviewCycle>>
}) {
  const waiting = props.inbox.kind === "ok" ? props.inbox.data.data : []
  const cycles = props.cycles.kind === "ok" ? props.cycles.data.data : []
  // 判断待ちを先に置く。どちらも評価期間ごとにまとめ、期間は新しい順にする。
  const rows: Row[] = [
    ...waiting.map((sheet) => ({ sheet, viewer: "evaluator" as const })),
    ...props.mine.map((sheet) => ({ sheet, viewer: "owner" as const })),
  ]
  const order = (cycleId: string) => {
    const index = cycles.findIndex((cycle) => cycle.id === cycleId)
    return index === -1 ? cycles.length : index
  }
  const groups = [...new Set(rows.map((row) => row.sheet.cycle_id))].sort(
    (a, b) => order(a) - order(b),
  )

  return (
    <>
      {waiting.length > 0 && (
        <Alert role="status">
          <Gavel />
          <AlertTitle>あなたの判断を待っているシートが {waiting.length}件 あります。</AlertTitle>
          <AlertDescription>
            開いて「判断する」から、承認するか理由を添えて戻してください。
          </AlertDescription>
        </Alert>
      )}
      {props.inbox.kind !== "ok" && (
        <Alert role="status">
          <AlertDescription>
            判断を待っているシートを読めませんでした。少し待ってから読み込み直してください。
          </AlertDescription>
        </Alert>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Target}
          title="まだ評価シートがありません"
          description="CLI か MCP で評価シートを登録すると、ここに出ます。"
        />
      ) : (
        groups.map((cycleId) => {
          const cycle = cycles.find((item) => item.id === cycleId)
          return (
            <section
              key={cycleId}
              aria-labelledby={`cycle-${cycleId}`}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <h2 id={`cycle-${cycleId}`} className="text-base font-medium">
                  <Link href={`/reviews/cycles/${cycleId}`}>{cycle?.name ?? "評価期間"}</Link>
                </h2>
                {cycle !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {formatPeriod(cycle.starts_on, cycle.ends_on)}
                  </p>
                )}
              </div>
              <ReviewSheetCards sheets={rows.filter((row) => row.sheet.cycle_id === cycleId)} />
            </section>
          )
        })
      )}
    </>
  )
}
