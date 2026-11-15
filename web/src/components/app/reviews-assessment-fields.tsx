import { scoreText, sectionName } from "@/components/app/reviews-model"
import type {
  ReviewAssessment,
  ReviewGoal,
  ReviewPolicy,
  ReviewSelfAssessment,
} from "@/components/app/reviews-types"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

/** 入力中の評価。点数は選ぶまで空。 */
export type AssessmentDraft = { score: string; comment: string }

export type AssessmentDrafts = Readonly<Record<string, AssessmentDraft>>

/** 足りない入力。どの目標のどの欄かを持ち、その欄の下に出す。 */
export type AssessmentProblem = { goalId: string; field: "score" | "comment"; message: string }

const EMPTY: AssessmentDraft = { score: "", comment: "" }

/** 目標ごとの空の入力を用意する。 */
export function emptyAssessmentDrafts(goals: ReadonlyArray<ReviewGoal>): AssessmentDrafts {
  return Object.fromEntries(goals.map((goal) => [goal.id, EMPTY]))
}

/** 全ての目標に評価があるかを確かめて送る形に直す。サーバーも全目標の評価を求める。 */
export function readAssessmentDrafts(
  goals: ReadonlyArray<ReviewGoal>,
  drafts: AssessmentDrafts,
): { kind: "ok"; assessments: ReviewAssessment[] } | { kind: "error"; error: AssessmentProblem } {
  const assessments: ReviewAssessment[] = []
  for (const [index, goal] of goals.entries()) {
    const draft = drafts[goal.id] ?? EMPTY
    const name = `目標${index + 1}`
    if (draft.score === "")
      return {
        kind: "error",
        error: { goalId: goal.id, field: "score", message: `${name}の点数を選んでください。` },
      }
    if (draft.comment.trim() === "")
      return {
        kind: "error",
        error: { goalId: goal.id, field: "comment", message: `${name}の根拠を入力してください。` },
      }
    assessments.push({
      goal_id: goal.id,
      score: Number(draft.score),
      comment: draft.comment.trim(),
    })
  }
  return { kind: "ok", assessments }
}

/**
 * 評価者が目標ごとに書く点数と根拠の入力。点数は期間で固定した尺度から選ぶ。
 * 判断の材料として、目標ごとに重み、本人の実績と自己評価、前の段階の評価を入力の上に出す。
 * 入力の名前は「目標1の点数」のように目標の番号を含め、画面の中で重ならないようにする。
 */
export function ReviewAssessmentFields(props: {
  goals: ReadonlyArray<ReviewGoal>
  policy: ReviewPolicy
  selfAssessments: ReadonlyArray<ReviewSelfAssessment>
  /** 前の段階の評価者の評価。一段目では空。 */
  previous: ReadonlyArray<ReviewAssessment>
  drafts: AssessmentDrafts
  onChange: (drafts: AssessmentDrafts) => void
  error?: AssessmentProblem | null
  disabled?: boolean
}) {
  const items = props.policy.scale.map((entry) => ({
    value: String(entry.value),
    label: entry.label === String(entry.value) ? entry.label : `${entry.value}（${entry.label}）`,
  }))

  function update(goalId: string, change: Partial<AssessmentDraft>) {
    const current = props.drafts[goalId] ?? EMPTY
    props.onChange({ ...props.drafts, [goalId]: { ...current, ...change } })
  }

  function errorFor(goalId: string, field: AssessmentProblem["field"]): string | null {
    return props.error?.goalId === goalId && props.error.field === field
      ? props.error.message
      : null
  }

  const sections = props.policy.sections.length > 1

  return (
    <div className="flex flex-col gap-4">
      {props.goals.map((goal, index) => {
        const draft = props.drafts[goal.id] ?? EMPTY
        const self = props.selfAssessments.find((item) => item.goal_id === goal.id)
        const previous = props.previous.find((item) => item.goal_id === goal.id)
        const name = `目標${index + 1}`
        const scoreError = errorFor(goal.id, "score")
        const commentError = errorFor(goal.id, "comment")
        return (
          <div key={goal.id} className="flex flex-col gap-4">
            {index > 0 && <Separator />}
            <FieldSet className="gap-4">
              <FieldLegend className="mb-0 break-words" variant="label">
                {name}: {goal.title}
              </FieldLegend>
              <div className="flex flex-col gap-2 rounded-xl bg-muted p-4">
                <p className="text-xs text-muted-foreground">
                  {sections && `${sectionName(props.policy, goal.section_key)} · `}重み{" "}
                  {goal.weight}
                </p>
                <p className="break-words whitespace-pre-wrap">
                  達成の基準: {goal.success_criteria}
                </p>
                <dl className="flex flex-col gap-2">
                  <dt className="text-xs text-muted-foreground">実績</dt>
                  <dd className="break-words whitespace-pre-wrap">
                    {self?.actual ?? "まだありません"}
                  </dd>
                  <dt className="text-xs text-muted-foreground">自己評価</dt>
                  <dd className="flex flex-col gap-1 break-words">
                    {self === undefined ? (
                      "まだありません"
                    ) : (
                      <>
                        <span className="font-medium">{scoreText(props.policy, self.score)}</span>
                        <span className="whitespace-pre-wrap">{self.comment}</span>
                      </>
                    )}
                  </dd>
                  {previous !== undefined && (
                    <>
                      <dt className="text-xs text-muted-foreground">前の段階の評価</dt>
                      <dd className="flex flex-col gap-1 break-words">
                        <span className="font-medium">
                          {scoreText(props.policy, previous.score)}
                        </span>
                        <span className="whitespace-pre-wrap">{previous.comment}</span>
                      </dd>
                    </>
                  )}
                </dl>
              </div>
              <FieldGroup className="gap-4">
                <Field invalid={scoreError !== null || undefined}>
                  <FieldLabel>
                    <span className="sr-only">{name}の</span>点数
                  </FieldLabel>
                  <Select
                    items={items}
                    value={draft.score === "" ? null : draft.score}
                    onValueChange={(value) =>
                      update(goal.id, { score: typeof value === "string" ? value : "" })
                    }
                    placeholder="選んでください"
                    disabled={props.disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {items.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {scoreError !== null && <FieldError>{scoreError}</FieldError>}
                </Field>
                <Field invalid={commentError !== null || undefined}>
                  <FieldLabel>
                    <span className="sr-only">{name}の</span>根拠
                  </FieldLabel>
                  <Textarea
                    value={draft.comment}
                    maxLength={3000}
                    rows={3}
                    disabled={props.disabled}
                    onValueChange={(value) => update(goal.id, { comment: value })}
                  />
                  {commentError !== null && <FieldError>{commentError}</FieldError>}
                </Field>
              </FieldGroup>
            </FieldSet>
          </div>
        )
      })}
    </div>
  )
}
