"use client"

import type { EntityId } from "@/lib/api/types/entity-id"
import { decideApplicationAction } from "@/app/(app)/system/applications/[application]/actions"
import type { ApplicationDecisionTarget } from "@/lib/api/types/application-types"
import type { DecisionState } from "@/app/(app)/system/applications/[application]/actions"
import { useFormAction } from "@/hooks/use-form-action"
import { TableRowActions } from "@/components/table-row-actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  applicationId: EntityId
  decisionTarget: ApplicationDecisionTarget
  negativeAction: "reject" | "return"
}

const initialState: DecisionState = { ok: false, error: null }

/**
 * 表示した申請本文と同じ版を承認/却下するフォーム。1 つの form 内で 2 つの送信ボタンを decision 値で分岐する。
 * 却下時のみコメント必須。useActionState の state でエラーを表示する。
 */
export function ApplicationDecisionForm(props: Props) {
  const negativeLabel = props.negativeAction === "return" ? "差戻し" : "却下"
  const action = useFormAction(decideApplicationAction, initialState, (_state, formData) =>
    formData.get("decision") === "approve"
      ? "申請を承認しました"
      : `申請を${negativeLabel}しました`,
  )

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="application_id" value={props.applicationId} />
      <input type="hidden" name="proposal_version" value={props.decisionTarget.proposal_version} />
      <input type="hidden" name="proposal_digest" value={props.decisionTarget.proposal_digest} />
      <input type="hidden" name="task_key" value={props.decisionTarget.task_key} />
      <input type="hidden" name="task_round" value={props.decisionTarget.task_round} />

      <FieldGroup>
        <Field data-invalid={state.error !== null}>
          <FieldLabel htmlFor={`decision-comment-${props.applicationId}`}>
            コメント（{negativeLabel}時は必須）
          </FieldLabel>
          <Textarea
            id={`decision-comment-${props.applicationId}`}
            name="comment"
            rows={2}
            placeholder={`${negativeLabel}の場合は理由を入力してください`}
            aria-invalid={state.error !== null}
            aria-describedby={
              state.error === null ? undefined : `decision-error-${props.applicationId}`
            }
          />
          {state.error !== null ? (
            <FieldError id={`decision-error-${props.applicationId}`}>{state.error}</FieldError>
          ) : null}
        </Field>

        <TableRowActions>
          <Button type="submit" name="decision" value="approve" size="sm" disabled={isPending}>
            承認
          </Button>

          <Button
            type="submit"
            name="decision"
            value="reject"
            size="sm"
            variant="destructive"
            disabled={isPending}
          >
            {negativeLabel}
          </Button>
        </TableRowActions>
      </FieldGroup>
    </form>
  )
}
