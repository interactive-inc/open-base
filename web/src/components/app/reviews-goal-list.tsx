import { Target } from "lucide-react"
import type { ReactNode } from "react"
import { EmptyState } from "@/components/app/data-view"
import { scoreText, sectionName, type EvaluatorReview } from "@/components/app/reviews-model"
import type { ReviewSheetDetail, ReviewSummary } from "@/components/app/reviews-types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

/**
 * 目標の一覧と、目標ごとの実績・自己評価・評価者の評価を並べる。目標は一件ごとにカードに置く。
 * 評価者の評価は判断の記録から読むので、まだ無いときは空として出す。
 */
export function ReviewGoalList(props: {
  sheet: ReviewSheetDetail
  evaluator: EvaluatorReview | null
}) {
  const { sheet } = props
  const policy = sheet.evaluation_policy
  const sections = policy.sections.length > 1

  return (
    <section aria-labelledby="review-goals-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="review-goals-title" className="text-base font-medium">
          目標と評価
        </h2>
        <p className="text-xs text-muted-foreground">
          尺度 {policy.scale.map((entry) => entry.label).join(" / ")}
        </p>
      </div>

      {sheet.goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="まだ目標がありません"
          description="CLI か MCP で目標を登録すると、ここに出ます。"
        />
      ) : (
        <ol className="flex flex-col gap-4">
          {sheet.goals.map((goal, index) => {
            const self = sheet.self_assessments.find((item) => item.goal_id === goal.id)
            const evaluated = props.evaluator?.assessments.find((item) => item.goal_id === goal.id)
            return (
              <li key={goal.id}>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h3 className="break-words">
                        {index + 1}. {goal.title}
                      </h3>
                    </CardTitle>
                    <CardDescription>
                      {sections && `${sectionName(policy, goal.section_key)} · `}重み {goal.weight}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <p className="break-words whitespace-pre-wrap">{goal.success_criteria}</p>
                    <Separator />
                    <dl className="grid gap-4 sm:grid-cols-3">
                      <Cell term="実績">{self?.actual}</Cell>
                      <Cell term="自己評価">
                        {self !== undefined && (
                          <>
                            <span className="font-medium">{scoreText(policy, self.score)}</span>
                            <span className="whitespace-pre-wrap">{self.comment}</span>
                          </>
                        )}
                      </Cell>
                      <Cell term="評価者の評価">
                        {evaluated !== undefined && (
                          <>
                            <span className="font-medium">
                              {scoreText(policy, evaluated.score)}
                            </span>
                            <span className="whitespace-pre-wrap">{evaluated.comment}</span>
                          </>
                        )}
                      </Cell>
                    </dl>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}

      {(sheet.self_evaluation_summary !== null || props.evaluator?.summary) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {sheet.self_evaluation_summary !== null && (
            <Summary term="自己評価の合計" summary={sheet.self_evaluation_summary} />
          )}
          {props.evaluator?.summary && (
            <Summary term="評価者の評価の合計" summary={props.evaluator.summary} />
          )}
        </div>
      )}
    </section>
  )
}

function Cell({ term, children }: { term: string; children: ReactNode }) {
  const empty = children === undefined || children === false || children === null
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="flex flex-col gap-1 break-words">
        {empty ? <span className="text-muted-foreground">まだありません</span> : children}
      </dd>
    </div>
  )
}

/** 重みを掛けた点数と、尺度の最小から最大までの中の位置。処遇の判断には使わない。 */
function Summary({ term, summary }: { term: string; summary: ReviewSummary }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{term}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">
          {summary.weighted_score}
        </CardTitle>
      </CardHeader>
      <CardContent>尺度の {summary.normalized_score}% の位置</CardContent>
    </Card>
  )
}
