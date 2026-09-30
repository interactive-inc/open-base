"use client"

import { GradeRevisionFields } from "@/app/(app)/company/grades/_components/grade-revision-fields"
import { useRouter } from "next/navigation"
import { useActionState } from "react"
import { toast } from "sonner"
import { createGradeAction } from "@/app/(app)/company/grades/actions"
import type { GradeActionState } from "@/app/(app)/company/grades/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = { companyRevision: number; commandId: string; gradeId: string }

const initialState: GradeActionState = { ok: false, error: null }

/** 等級作成フォーム。code/name/rank 必須、説明は任意。成功時は /grades へ戻す。 */
export function GradeCreateForm(props: Props) {
  const router = useRouter()

  async function reduce(
    previousState: GradeActionState,
    formData: FormData,
  ): Promise<GradeActionState> {
    const result = await createGradeAction(previousState, formData)

    if (result.ok) {
      toast.success("等級を作成しました")

      router.push("/company/grades")
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
        <GradeRevisionFields
          id={props.gradeId}
          companyRevision={props.companyRevision}
          resourceRevision={0}
          commandId={props.commandId}
          effectiveFrom=""
          effectiveTo={null}
        />
        <Field>
          <FieldLabel htmlFor="grade-code">コード</FieldLabel>

          <Input
            id="grade-code"
            name="code"
            placeholder="G1"
            maxLength={FORM_CONSTRAINTS.grade.codeMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="grade-name">名称</FieldLabel>

          <Input
            id="grade-name"
            name="name"
            placeholder="メンバー"
            maxLength={FORM_CONSTRAINTS.grade.nameMax}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="grade-rank">ランク</FieldLabel>

          <Input
            id="grade-rank"
            name="rank"
            type="number"
            inputMode="numeric"
            min={FORM_CONSTRAINTS.grade.rankMin}
            max={FORM_CONSTRAINTS.grade.rankMax}
            step={1}
            placeholder="不明なら空欄"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="grade-description">説明（任意）</FieldLabel>

          <Textarea
            id="grade-description"
            name="description"
            maxLength={FORM_CONSTRAINTS.grade.descriptionMax}
          />
        </Field>

        {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

        <Field orientation="horizontal">
          <Button type="submit" disabled={isPending}>
            {isPending ? "作成中..." : "等級を作成"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
