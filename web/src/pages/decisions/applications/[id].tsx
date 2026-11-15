import { Link } from "@void/react"
import { useState } from "react"
import type { ApplicationDetail, Template } from "@/components/app/application-types"
import { DecisionHistory } from "@/components/app/applications-decision-history"
import { PayloadList, toPayloadLabels } from "@/components/app/applications-payload-list"
import { AuthFrame } from "@/components/app/auth-frame"
import { formatDate } from "@/components/app/data-view"
import { PhaseBar } from "@/components/app/phase-bar"
import { sendApiJson, useApiJson } from "@/components/app/use-api-json"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import type { Props } from "./[id].server"

/** サイドバーを出さないレイアウトを使う。CLIが表示したURLを開き、判断だけをする画面。 */
export const layout = "bare"

type DecisionProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

type Action = "approve" | "reject"

type Outcome = { action: Action; detail: ApplicationDetail }

const STATUS_TEXT: Readonly<Record<ApplicationDetail["status"], string>> = {
  pending: "まだ決まっていませんが、あなたが判断する番ではありません。",
  approved: "この申請はすでに承認されています。",
  rejected: "この申請はすでに却下されています。",
}

/** 申請の判断。判断に要る内容とこれまでの経過を見せ、承認か却下を記録する。 */
export default function ApplicationDecisionPage({ email, id, initial }: DecisionProps) {
  const application = useApiJson<ApplicationDetail>(
    `/company/application-requests/${id}`,
    initial?.application,
  )
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const footer = `${email} として判断します。`

  // 判断の後は一覧へ移らず、結果をこの場に出す。
  if (outcome !== null) {
    return (
      <AuthFrame
        title={outcome.action === "approve" ? "承認しました" : "却下しました"}
        description={`${outcome.detail.template_name}（申請番号 ${outcome.detail.id}）の判断を記録しました。この画面は閉じてかまいません。`}
        footer={footer}
      >
        <DetailLink id={outcome.detail.id} />
      </AuthFrame>
    )
  }
  if (application.kind === "loading") {
    return (
      <AuthFrame title="申請の判断" footer={footer} width="wide">
        <Skeleton className="h-48 w-full" />
      </AuthFrame>
    )
  }
  if (application.kind !== "ok") {
    return (
      <AuthFrame
        title="申請の判断"
        error={
          application.kind === "forbidden"
            ? "この申請を表示する権限がないか、申請が見つかりません。"
            : "読み込めませんでした。少し待ってから読み込み直してください。"
        }
        footer={footer}
      />
    )
  }
  const detail = application.data
  if (!detail.can_decide) {
    return (
      <AuthFrame
        title="この申請は判断できません"
        description={STATUS_TEXT[detail.status]}
        footer={footer}
      >
        <DetailLink id={detail.id} />
      </AuthFrame>
    )
  }

  return (
    <DecisionForm
      detail={detail}
      templateState={initial?.template ?? undefined}
      footer={footer}
      onDecided={(action) => setOutcome({ action, detail })}
    />
  )
}

function DetailLink(props: { id: number }) {
  return (
    <Button render={<Link href={`/applications/${props.id}`} />} className="self-start">
      申請の詳細を見る
    </Button>
  )
}

function DecisionForm(props: {
  detail: ApplicationDetail
  templateState: NonNullable<Props["initial"]>["template"] | undefined
  footer: string
  onDecided: (action: Action) => void
}) {
  const { detail } = props
  const template = useApiJson<Template>(
    `/company/application-templates/${encodeURIComponent(detail.template_code)}`,
    props.templateState ?? undefined,
  )
  const [comment, setComment] = useState("")
  const [commentError, setCommentError] = useState<string | null>(null)
  const [confirmReject, setConfirmReject] = useState(false)
  const [sending, setSending] = useState<Action | null>(null)
  const [error, setError] = useState("")

  async function decide(action: Action) {
    setSending(action)
    setError("")
    // 見ていた版をそのまま送る。その間に内容が変わっていれば、サーバーが受け付けない。
    const result = await sendApiJson(
      "POST",
      `/company/application-requests/${detail.id}/${action}`,
      {
        decision_target: detail.decision_target,
        comment: comment.trim() === "" ? null : comment.trim(),
      },
    )
    if (result.kind === "error") {
      setError(result.message)
      setSending(null)
      return
    }
    props.onDecided(action)
  }

  /** 却下は理由が要る。書いてあれば、取り消せないことを確かめてから送る。 */
  function requestReject() {
    if (comment.trim() === "") {
      setCommentError("却下するときは、理由をコメントに書いてください。")
      return
    }
    setConfirmReject(true)
  }

  return (
    <AuthFrame
      title={`${detail.template_name}の判断`}
      description={`${detail.applicant_name || "申請者不明"} · ${formatDate(detail.created_at)} · 申請番号 ${detail.id}`}
      error={error}
      footer={props.footer}
      width="wide"
    >
      <section className="flex flex-col gap-4" aria-labelledby="decision-payload">
        <h2 id="decision-payload" className="text-sm font-medium">
          申請の内容
        </h2>
        <PayloadList payload={detail.payload} labels={toPayloadLabels(template)} />
      </section>

      {detail.workflow !== null && detail.workflow.steps.length > 0 && (
        <>
          <Separator />
          <section className="flex flex-col gap-4" aria-labelledby="decision-progress">
            <h2 id="decision-progress" className="text-sm font-medium">
              これまでの経過
            </h2>
            <PhaseBar phases={detail.workflow.steps} label="承認の段階" />
            <DecisionHistory approvals={detail.workflow.approvals} />
          </section>
        </>
      )}

      <Separator />

      <Field invalid={commentError !== null} disabled={sending !== null}>
        <FieldLabel>コメント</FieldLabel>
        <Textarea
          value={comment}
          onValueChange={(value) => {
            setComment(value)
            setCommentError(null)
          }}
          maxLength={3000}
          rows={3}
        />
        <FieldDescription>却下するときは必ず書いてください。</FieldDescription>
        {commentError !== null && <FieldError>{commentError}</FieldError>}
      </Field>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="destructive" disabled={sending !== null} onClick={requestReject}>
          却下する
        </Button>
        <Button
          disabled={sending !== null}
          onClick={() => decide("approve")}
          data-agent-confirm={`${detail.template_name}（申請番号 ${detail.id}）を承認します。取り消せません`}
        >
          承認する
        </Button>
      </div>

      <AlertDialog open={confirmReject} onOpenChange={setConfirmReject}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>この申請を却下しますか?</AlertDialogTitle>
            <AlertDialogDescription>
              {detail.template_name}（申請番号 {detail.id}
              ）を却下し、コメントを申請者に伝えます。却下は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>戻る</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              value="confirm"
              action={() => decide("reject")}
              data-agent-confirm={`${detail.template_name}（申請番号 ${detail.id}）を却下します。取り消せません`}
            >
              却下を確定する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthFrame>
  )
}
