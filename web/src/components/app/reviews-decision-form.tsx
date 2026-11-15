import { CircleAlertIcon } from "lucide-react"
import { useState } from "react"
import { PhaseBar, type PhaseStatus } from "@/components/app/phase-bar"
import {
  emptyAssessmentDrafts,
  ReviewAssessmentFields,
  readAssessmentDrafts,
  type AssessmentDrafts,
  type AssessmentProblem,
} from "@/components/app/reviews-assessment-fields"
import { useReviewCommand } from "@/components/app/reviews-command"
import type {
  ReviewAssessment,
  ReviewDecisionTarget,
  ReviewSheet,
  ReviewWorkflowStep,
} from "@/components/app/reviews-types"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  createConfirm,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"

/** 評価者の判断。承認、差し戻し、却下。 */
export type ReviewDecision = "approve" | "return" | "reject"

/** 入力が足りないときに、どの欄の下に出すか。 */
type Invalid =
  | { kind: "reason"; message: string }
  | { kind: "assessment"; error: AssessmentProblem }

/**
 * 評価者の判断。目標の段階は承認か戻すか、評価の段階は目標ごとの点数と根拠を書いて承認する。
 * 戻すときに差し戻しと却下のどちらになるかは、期間で固定した承認経路の段階が決める。
 * 経路が読めないときは両方を出し、合わない方はサーバーが拒む。
 * 最後の段階の承認は評価を確定し、取り消せないので、送る前に確かめる。
 */
export function ReviewDecisionForm(props: {
  sheet: ReviewSheet
  target: ReviewDecisionTarget
  /** 今の段階の承認経路。期間を読めないときはnull。 */
  steps: ReadonlyArray<ReviewWorkflowStep> | null
  /** 前の段階の評価者の評価。一段目では空。 */
  previous: ReadonlyArray<ReviewAssessment>
  /** 判断を記録した後に、判断と更新後のシートを渡す。 */
  onDecided: (decision: ReviewDecision, sheet: ReviewSheet) => void
}) {
  const { sheet, target } = props
  const phase = sheet.status === "evaluation_pending" ? "evaluation" : "goals"
  const command = useReviewCommand(sheet)
  const [confirm] = useState(() => createConfirm())
  const [reason, setReason] = useState("")
  const [invalid, setInvalid] = useState<Invalid | null>(null)
  const [assessments, setAssessments] = useState<AssessmentDrafts>(() =>
    emptyAssessmentDrafts(sheet.goals),
  )
  const sending = command.sending !== null
  const index = props.steps?.findIndex((step) => step.key === target.task_key) ?? -1
  const step = index >= 0 ? props.steps?.[index] : undefined
  const last = props.steps !== null && index === props.steps.length - 1
  const finalizes = phase === "evaluation" && last
  const backActions: ReadonlyArray<ReviewDecision> =
    step === undefined ? ["return", "reject"] : [step.rejection_behavior ?? "reject"]

  async function decide(action: ReviewDecision) {
    setInvalid(null)
    const base = { operation: "decide", action, target }
    let done: ReviewSheet | null = null
    if (action !== "approve") {
      if (reason.trim() === "")
        return setInvalid({
          kind: "reason",
          message: `${action === "return" ? "差し戻す" : "却下する"}ときは、理由を書いてください。`,
        })
      done = await command.run(action, { ...base, reason: reason.trim() })
    } else if (phase === "goals") {
      done = await command.run(action, { ...base, reason: reason.trim() || "目標を承認します" })
    } else {
      const read = readAssessmentDrafts(sheet.goals, assessments)
      if (read.kind === "error") return setInvalid({ kind: "assessment", error: read.error })
      if (finalizes && !(await confirm())) return
      done = await command.run(action, {
        ...base,
        assessments: read.assessments,
        reason: reason.trim() || "評価を承認します",
      })
    }
    if (done !== null) props.onDecided(action, done)
  }

  const approveText =
    phase === "goals" ? "目標を承認する" : last ? "評価を確定する" : "評価を承認する"

  return (
    <section aria-labelledby="review-decision-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="review-decision-title" className="text-base font-medium">
          あなたの判断
        </h2>
        <p>
          {phase === "goals"
            ? "目標と重みを確かめてください。承認すると本人は自己評価に進みます。"
            : last
              ? "目標ごとに点数と根拠を書いてください。承認すると評価が確定し、変更できなくなります。"
              : "目標ごとに点数と根拠を書いてください。承認すると次の段階の評価者に回ります。"}
        </p>
      </div>

      {props.steps !== null && props.steps.length > 1 && (
        <PhaseBar
          label="承認の段階"
          phases={props.steps.map((item, i) => ({
            key: item.key,
            name: item.name,
            status: (i < index ? "approved" : i === index ? "pending" : "waiting") as PhaseStatus,
          }))}
        />
      )}

      {phase === "evaluation" && (
        <ReviewAssessmentFields
          goals={sheet.goals}
          policy={sheet.evaluation_policy}
          selfAssessments={sheet.self_assessments}
          previous={props.previous}
          drafts={assessments}
          onChange={setAssessments}
          error={invalid?.kind === "assessment" ? invalid.error : null}
          disabled={sending}
        />
      )}

      <Field invalid={invalid?.kind === "reason" || undefined}>
        <FieldLabel>コメント</FieldLabel>
        <Textarea
          value={reason}
          onValueChange={setReason}
          maxLength={3000}
          rows={3}
          disabled={sending}
        />
        <FieldDescription>
          本人に見えます。戻すときは、直してほしい点を必ず書いてください。
        </FieldDescription>
        {invalid?.kind === "reason" && <FieldError>{invalid.message}</FieldError>}
      </Field>

      {command.error !== null && (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertDescription>{command.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {backActions.map((action) => (
          <Button
            key={action}
            variant={action === "reject" ? "destructive" : "secondary"}
            disabled={sending}
            onClick={() => void decide(action)}
          >
            {command.sending === action && <Spinner data-icon="inline-start" />}
            {action === "return" ? "差し戻す" : "却下する"}
          </Button>
        ))}
        <Button disabled={sending} onClick={() => void decide("approve")}>
          {command.sending === "approve" && <Spinner data-icon="inline-start" />}
          {approveText}
        </Button>
      </div>

      <AlertDialog controller={confirm.controller}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この評価で確定しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              確定すると評価は変更できなくなります。本人には確定した評価が見えます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>見直す</AlertDialogCancel>
            <AlertDialogAction
              value="confirm"
              data-agent-confirm="この評価シートの評価を確定します。確定した評価は変更できません"
            >
              確定する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
