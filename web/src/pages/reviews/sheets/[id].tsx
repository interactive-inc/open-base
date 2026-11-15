import { Gavel } from "lucide-react"
import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { BackLink, formatDate, Loaded, PageHeader, TextSkeleton } from "@/components/app/data-view"
import { ReviewGoalList } from "@/components/app/reviews-goal-list"
import { ReviewHistory } from "@/components/app/reviews-history"
import {
  employeeText,
  evaluatorReview,
  isPending,
  latestReturn,
  sheetTurn,
  type ReviewViewer,
} from "@/components/app/reviews-model"
import { isReviewId, reviewApi } from "@/components/app/reviews-paths"
import { ReviewTurnPanel } from "@/components/app/reviews-status"
import type {
  ReviewCycleDetail,
  ReviewHistoryEntry,
  ReviewInboxSheet,
  ReviewPage,
  ReviewSheet,
  ReviewSheetDetail,
} from "@/components/app/reviews-types"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }
type Initial = NonNullable<Props["initial"]>

/**
 * 評価シートの一件。一番上に、いま誰の番で次に何をするかを出す。
 * その下に目標と評価、版の履歴を並べる。書き込みはCLIかMCPで行い、
 * 評価者の判断だけは判断の画面へ移って行う。
 */
export default function ReviewSheetPage({ email, pathname, id, initial }: DetailProps) {
  const valid = isReviewId(id)
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const sheet = useApiJson<ReviewSheetDetail>(
    reviewApi.sheet(id),
    valid ? initial?.sheet : { kind: "forbidden" },
  )
  const history = useApiJson<ReviewPage<ReviewHistoryEntry>>(
    reviewApi.history(id),
    valid ? initial?.history : { kind: "forbidden" },
  )

  return (
    <>
      <BackLink href="/reviews">評価の一覧</BackLink>

      <Loaded
        state={sheet}
        fallback={
          <>
            <PageHeader
              title={<TextSkeleton placeholder="評価シートの見出し" label="評価シート" />}
            />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-64 w-full" />
          </>
        }
      >
        {(data) => (
          <SheetInCycle key={data.cycle_id} sheet={data} history={history} initial={initial} />
        )}
      </Loaded>
    </>
  )
}

/** 評価期間と、見ている人との関係を読む。期間が変わらない限り作り直さない。 */
function SheetInCycle(props: {
  sheet: ReviewSheetDetail
  history: ApiJsonState<ReviewPage<ReviewHistoryEntry>>
  initial: Initial | undefined
}) {
  const { sheet } = props
  const cycle = useApiJson<ReviewCycleDetail>(
    reviewApi.cycle(sheet.cycle_id),
    props.initial?.cycle ?? undefined,
  )
  const mine = useApiJson<ReviewPage<ReviewSheet>>(
    reviewApi.mySheets(sheet.cycle_id),
    props.initial?.mine ?? undefined,
  )
  const inbox = useApiJson<ReviewPage<ReviewInboxSheet>>(
    reviewApi.inbox(sheet.cycle_id),
    props.initial?.inbox ?? undefined,
  )

  // 本人のシートか、いま判断できるシートかは、サーバーの一覧で決まる。
  const viewer: ReviewViewer | null =
    mine.kind === "ok" && mine.data.data.some((item) => item.id === sheet.id)
      ? "owner"
      : inbox.kind === "ok" && inbox.data.data.some((item) => item.id === sheet.id)
        ? "evaluator"
        : mine.kind === "loading" || inbox.kind === "loading"
          ? null
          : "other"
  const entries = props.history.kind === "ok" ? props.history.data.data : []
  const canDecide =
    viewer === "evaluator" && isPending(sheet.status) && sheet.decision_target !== null
  const ownerTurn = viewer === "owner" && sheetTurn(sheet, viewer).actor === "owner"

  return (
    <>
      <PageHeader
        title={
          viewer === "owner"
            ? "あなたの評価シート"
            : `${employeeText(sheet.employee_id)} の評価シート`
        }
        description={
          <>
            <Link href={`/reviews/cycles/${sheet.cycle_id}`}>
              {cycle.kind === "ok" ? cycle.data.name : "評価期間"}
            </Link>{" "}
            · 版 {sheet.revision} · 更新 {formatDate(sheet.updated_at)}
          </>
        }
        action={
          viewer === null ? (
            <Skeleton className="h-9 w-28 rounded-4xl" />
          ) : canDecide ? (
            <Button render={<Link href={`/decisions/reviews/${sheet.id}`} />}>
              <Gavel data-icon="inline-start" aria-hidden="true" />
              判断する
            </Button>
          ) : undefined
        }
      />

      <ReviewTurnPanel sheet={sheet} viewer={viewer ?? "other"} returned={latestReturn(entries)}>
        {ownerTurn ? (
          <p>目標の登録、自己評価、提出、取り消しは CLI か MCP で行います。</p>
        ) : viewer !== null && !canDecide && (mine.kind !== "ok" || inbox.kind !== "ok") ? (
          <Alert role="status">
            <AlertDescription>
              あなたがこのシートを判断できるかを確かめられませんでした。読み込み直してください。
            </AlertDescription>
          </Alert>
        ) : null}
      </ReviewTurnPanel>

      <ReviewGoalList sheet={sheet} evaluator={evaluatorReview(entries)} />

      <Loaded state={props.history} fallback={<Skeleton className="h-40 w-full" />}>
        {(page) => (
          <ReviewHistory
            entries={page.data}
            ownerAccountId={sheet.owner_account_id}
            truncated={page.next_offset !== null}
          />
        )}
      </Loaded>
    </>
  )
}
