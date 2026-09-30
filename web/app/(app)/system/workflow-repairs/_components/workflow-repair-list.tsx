"use client"

import Link from "next/link"
import { useActionState } from "react"
import { toast } from "sonner"
import {
  reassignWorkflowStepAction,
  type WorkflowRepairState,
} from "@/app/(app)/system/workflow-repairs/actions"
import { EmptyState } from "@/components/empty-state"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { StatusLabel } from "@/components/status-label"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { WorkflowRepair } from "@/lib/api/get-workflow-repairs"
import { formatDateTime } from "@/lib/format-date-time"

const initialState: WorkflowRepairState = { ok: false, error: null }

const reasonLabels: Record<WorkflowRepair["reason"], string> = {
  snapshot_missing: "承認者スナップショットがありません",
  inactive_candidates: "候補者が無効または不足",
}

export function WorkflowRepairList(props: { repairs: ReadonlyArray<WorkflowRepair> }) {
  if (props.repairs.length === 0) {
    return (
      <EmptyState
        title="修復が必要な承認フローはありません"
        description="候補者が不足した申請はここに表示されます。"
      />
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {props.repairs.map((repair) => (
        <WorkflowRepairCard key={repair.id} repair={repair} />
      ))}
    </div>
  )
}

function WorkflowRepairCard(props: { repair: WorkflowRepair }) {
  const [state, action, pending] = useActionState(
    async (previous: WorkflowRepairState, formData: FormData) => {
      const next = await reassignWorkflowStepAction(previous, formData)

      if (next.ok) {
        toast.success("承認候補者を再割当しました")
      } else if (next.error !== null) {
        toast.error(next.error)
      }

      return next
    },
    initialState,
  )

  const repair = props.repair
  const formId = `workflow-repair-${repair.id}`

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link
            href={`/system/applications/${repair.id}`}
            className="underline-offset-4 hover:underline"
          >
            {repair.template_name}
          </Link>
        </CardTitle>
        <CardDescription>
          申請 ID {repair.id} ・ {repair.applicant_name ?? "申請者不明"} ・開始{" "}
          {formatDateTime(repair.started_at)}
        </CardDescription>
        <CardAction>
          <StatusLabel>{reasonLabels[repair.reason]}</StatusLabel>
        </CardAction>
      </CardHeader>

      <CardContent>
        <form id={formId} action={action}>
          <input type="hidden" name="application_id" value={repair.id} />

          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={state.error !== null}>
                <FieldLabel htmlFor={`repair-candidates-${repair.id}`}>候補従業員 ID</FieldLabel>
                <Input
                  id={`repair-candidates-${repair.id}`}
                  name="candidate_employee_ids"
                  placeholder="例: 12, 34…"
                  required
                  aria-invalid={state.error !== null}
                />
                <FieldDescription>
                  有効なアカウントを持つ従業員 ID を最大 20 件指定します。
                </FieldDescription>
              </Field>

              <Field>
                <FieldTitle>対象ステップ</FieldTitle>
                <div className="rounded-md bg-card border px-4 py-2 text-sm">
                  {repair.step_key}（ラウンド {repair.round}）
                </div>
              </Field>
            </div>

            {repair.reason === "snapshot_missing" ? (
              <Field data-invalid={state.error !== null}>
                <FieldLabel htmlFor={`repair-required-approvals-${repair.id}`}>
                  必要承認数（全員承認の場合）
                </FieldLabel>
                <Input
                  id={`repair-required-approvals-${repair.id}`}
                  name="required_approvals"
                  type="number"
                  min={1}
                  max={20}
                  aria-invalid={state.error !== null}
                />
                <FieldDescription>
                  全員承認のスナップショットがない場合だけ、候補者数と同じ値を入力します。この上書きは監査イベントに記録されます。
                </FieldDescription>
              </Field>
            ) : null}

            <Field data-invalid={state.error !== null}>
              <FieldLabel htmlFor={`repair-reason-${repair.id}`}>再割当理由</FieldLabel>
              <Textarea
                id={`repair-reason-${repair.id}`}
                name="reason"
                rows={3}
                maxLength={1_000}
                placeholder="例: 退職した承認者から後任者へ再割当…"
                required
                aria-invalid={state.error !== null}
              />
              <FieldDescription>理由と操作者は監査イベントに記録されます。</FieldDescription>
              <div aria-live="polite">
                {state.error !== null ? <FieldError>{state.error}</FieldError> : null}
              </div>
            </Field>

            <AlertDialog>
              <AlertDialogTrigger render={<Button type="button" disabled={pending} />}>
                {pending ? "再割当中…" : "候補者を再割当"}
              </AlertDialogTrigger>

              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>承認候補者を再割当しますか？</AlertDialogTitle>
                  <AlertDialogDescription>
                    現在の候補者スナップショットを新しい監査ラウンドへ差し替えます。入力した理由、操作者、必要承認数の上書きは履歴に残ります。
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>やめる</AlertDialogCancel>
                  <AlertDialogAction type="submit" form={formId} disabled={pending}>
                    再割当を確定
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
