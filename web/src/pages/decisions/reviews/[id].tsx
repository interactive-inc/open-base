import { MessageSquareWarningIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import { AuthFrame } from "@/components/app/auth-frame"
import { Loaded } from "@/components/app/data-view"
import { ReviewDecisionForm, type ReviewDecision } from "@/components/app/reviews-decision-form"
import {
  employeeText,
  evaluatorReview,
  formatPeriod,
  isPending,
  latestReturn,
  sectionName,
  STATUS_TEXT,
} from "@/components/app/reviews-model"
import { isReviewId, reviewApi } from "@/components/app/reviews-paths"
import type {
  ReviewCycleDetail,
  ReviewHistoryEntry,
  ReviewInboxSheet,
  ReviewPage,
  ReviewSheet,
  ReviewSheetDetail,
} from "@/components/app/reviews-types"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { Props } from "./[id].server"

type PageProps = Omit<Props, "initial"> & { initial?: Props["initial"] }
type Initial = NonNullable<Props["initial"]>

/** サイドバーを出さないレイアウトを使う。CLIが表示したURLを人がブラウザーで開く。 */
export const layout = "bare"

const DONE_TEXT: Readonly<Record<ReviewDecision, string>> = {
  approve: "承認しました。",
  return: "差し戻しました。",
  reject: "却下しました。",
}

/**
 * 評価シートへの評価者の判断。誰のシートか、期間、目標と重み、自己評価と、判断のフォームだけを出す。
 * 読む量と入力が多いので、広い枠を使う。判断の後は結果をこの画面に出し、ほかの画面へは移らない。
 */
export default function ReviewDecisionPage({ id, initial }: PageProps) {
  const valid = isReviewId(id)
  const sheet = useApiJson<ReviewSheetDetail>(
    reviewApi.sheet(id),
    valid ? initial?.sheet : { kind: "forbidden" },
  )
  const history = useApiJson<ReviewPage<ReviewHistoryEntry>>(
    reviewApi.history(id),
    valid ? initial?.history : { kind: "forbidden" },
  )
  // 判断の結果は送信の応答で出す。シートを読み直しても判断の画面には戻さない。
  const [decided, setDecided] = useState<{ decision: ReviewDecision; sheet: ReviewSheet } | null>(
    null,
  )
  const phase = sheet.kind === "ok" ? sheet.data.status : null

  return (
    <AuthFrame
      width="wide"
      title={
        phase === "goals_pending"
          ? "目標の判断"
          : phase === "evaluation_pending"
            ? "評価の判断"
            : "評価シートの判断"
      }
      description={
        decided === null ? "内容を確かめて、承認するか理由を添えて戻します。" : undefined
      }
    >
      <Loaded state={sheet} fallback={<Skeleton className="h-48 w-full" />}>
        {(data) =>
          decided !== null ? (
            <Decided sheet={decided.sheet} decision={decided.decision} />
          ) : (
            <Decision
              key={data.cycle_id}
              sheet={data}
              history={history}
              initial={initial}
              onDecided={(decision, next) => setDecided({ decision, sheet: next })}
            />
          )
        }
      </Loaded>
    </AuthFrame>
  )
}

/** 判断の結果。判断した後のシートの状態を添える。 */
function Decided(props: { sheet: ReviewSheet; decision: ReviewDecision }) {
  return (
    <>
      <div role="status" className="flex flex-col gap-1">
        <p className="font-medium">{DONE_TEXT[props.decision]}</p>
        <p>
          {employeeText(props.sheet.employee_id)} の評価シートは「
          {STATUS_TEXT[props.sheet.status]}」になりました。
        </p>
      </div>
      <Button className="self-end" render={<Link href={`/reviews/sheets/${props.sheet.id}`} />}>
        評価シートを開く
      </Button>
    </>
  )
}

/** 期間と、いま判断できるかを読み、判断に要る情報とフォームを出す。 */
function Decision(props: {
  sheet: ReviewSheetDetail
  history: ApiJsonState<ReviewPage<ReviewHistoryEntry>>
  initial: Initial | undefined
  onDecided: (decision: ReviewDecision, sheet: ReviewSheet) => void
}) {
  const { sheet } = props
  const cycle = useApiJson<ReviewCycleDetail>(
    reviewApi.cycle(sheet.cycle_id),
    props.initial?.cycle ?? undefined,
  )
  const inbox = useApiJson<ReviewPage<ReviewInboxSheet>>(
    reviewApi.inbox(sheet.cycle_id),
    props.initial?.inbox ?? undefined,
  )
  const entries = props.history.kind === "ok" ? props.history.data.data : []
  const returned = latestReturn(entries)
  const evaluation = sheet.status === "evaluation_pending"
  const steps =
    cycle.kind !== "ok"
      ? null
      : evaluation
        ? cycle.data.evaluation_approval.workflow.steps
        : cycle.data.goal_approval.workflow.steps
  const waiting =
    inbox.kind === "ok" &&
    inbox.data.data.some((item) => item.id === sheet.id) &&
    isPending(sheet.status)
  const policy = sheet.evaluation_policy

  return (
    <>
      <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-2">
        <dt className="text-muted-foreground">対象</dt>
        <dd>{employeeText(sheet.employee_id)} の評価シート</dd>
        <dt className="text-muted-foreground">評価期間</dt>
        <dd className="flex flex-col">
          {cycle.kind === "ok" ? (
            <>
              <span>{cycle.data.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatPeriod(cycle.data.starts_on, cycle.data.ends_on)}
              </span>
            </>
          ) : (
            "読み込めませんでした"
          )}
        </dd>
        <dt className="text-muted-foreground">状態</dt>
        <dd>{STATUS_TEXT[sheet.status]}</dd>
      </dl>

      {returned !== null && (
        <Alert role="status">
          <MessageSquareWarningIcon />
          <AlertTitle>
            前回{returned.action === "return" ? "差し戻した" : "却下した"}理由
          </AlertTitle>
          <AlertDescription className="break-words whitespace-pre-wrap text-foreground">
            {returned.reason}
          </AlertDescription>
        </Alert>
      )}

      {!evaluation && (
        <section aria-labelledby="decision-goals-title" className="flex flex-col gap-2">
          <h2 id="decision-goals-title" className="text-base font-medium">
            目標と重み
          </h2>
          {sheet.goals.length === 0 ? (
            <p>目標がありません。</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {sheet.goals.map((goal, index) => (
                <li key={goal.id}>
                  <Item variant="muted" size="sm">
                    <ItemContent>
                      <ItemTitle className="line-clamp-none break-words">
                        {index + 1}. {goal.title}
                      </ItemTitle>
                      <ItemDescription>
                        {policy.sections.length > 1 &&
                          `${sectionName(policy, goal.section_key)} · `}
                        重み {goal.weight}
                      </ItemDescription>
                      <p className="break-words whitespace-pre-wrap">
                        達成の基準: {goal.success_criteria}
                      </p>
                    </ItemContent>
                  </Item>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <Separator />

      {inbox.kind === "loading" ? (
        <Skeleton className="h-32 w-full" />
      ) : waiting && sheet.decision_target !== null ? (
        <ReviewDecisionForm
          key={sheet.revision}
          sheet={sheet}
          target={sheet.decision_target}
          steps={steps}
          previous={evaluatorReview(entries)?.assessments ?? []}
          onDecided={props.onDecided}
        />
      ) : (
        <Alert role="status">
          <AlertDescription>
            {inbox.kind !== "ok"
              ? "あなたがこのシートを判断できるかを確かめられませんでした。読み込み直してください。"
              : "このシートは今、あなたの判断を待っていません。"}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}
