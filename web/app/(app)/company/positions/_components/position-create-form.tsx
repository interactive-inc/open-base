"use client"

import { PositionRevisionFields } from "@/app/(app)/company/positions/_components/position-revision-fields"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createPositionAction } from "@/app/(app)/company/positions/actions"
import type { PositionActionState } from "@/app/(app)/company/positions/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = { companyRevision: number; commandId: string; positionId: string }

const initialState: PositionActionState = { ok: false, error: null }

/** 役職作成フォーム。code/name/rank 必須、説明は任意。成功時は /positions へ戻す。 */
export function PositionCreateForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: PositionActionState,
    formData: FormData,
  ): Promise<PositionActionState> {
    const result = await createPositionAction(previousState, formData)

    if (result.ok) {
      toast.success("役職を作成しました")

      router.push("/company/positions")
    } else if (result.error !== null) {
      toast.error(result.error)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  return (
    <form action={formAction}>
      <FieldGroup>
        <PositionRevisionFields
          jobId={null}
          id={props.positionId}
          companyRevision={props.companyRevision}
          resourceRevision={0}
          commandId={props.commandId}
          effectiveFrom=""
          effectiveTo={null}
        />
        <Field>
          <FieldLabel htmlFor="position-code">コード</FieldLabel>

          <Input
            id="position-code"
            name="code"
            placeholder="G1"
            maxLength={FORM_CONSTRAINTS.position.codeMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="position-name">名称</FieldLabel>

          <Input
            id="position-name"
            name="name"
            placeholder="メンバー"
            maxLength={FORM_CONSTRAINTS.position.nameMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="position-rank">ランク</FieldLabel>

          <Input
            id="position-rank"
            name="rank"
            type="number"
            inputMode="numeric"
            min={FORM_CONSTRAINTS.position.rankMin}
            max={FORM_CONSTRAINTS.position.rankMax}
            step={1}
            placeholder="不明なら空欄"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="position-description">説明（任意）</FieldLabel>

          <Textarea
            id="position-description"
            name="description"
            maxLength={FORM_CONSTRAINTS.position.descriptionMax}
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "役職を作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
