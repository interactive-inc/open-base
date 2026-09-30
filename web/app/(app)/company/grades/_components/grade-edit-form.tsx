"use client"

import { GradeRevisionFields } from "@/app/(app)/company/grades/_components/grade-revision-fields"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { updateGradeAction } from "@/app/(app)/company/grades/actions"
import type { GradeActionState } from "@/app/(app)/company/grades/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { GradeResponse } from "@/lib/api/types/grade-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  grade: GradeResponse
}

const initialState: GradeActionState = { ok: false, error: null }

/** 等級編集フォームを Dialog で開く。コード・名称・ランク・説明を変更して送信する。 */
export function GradeEditForm(props: Props) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: GradeActionState,
    formData: FormData,
  ): Promise<GradeActionState> {
    const result = await updateGradeAction(previousState, formData)

    if (result.ok) {
      toast.success("等級を更新しました")

      setOpen(false)
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>変更</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>等級を変更</DialogTitle>

          <DialogDescription>コード・名称・ランク・説明を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <GradeRevisionFields
            id={props.grade.id}
            companyRevision={props.grade.organizationRevision}
            resourceRevision={props.grade.revision}
            commandId={props.grade.commandId}
            effectiveFrom={props.grade.effectiveFrom}
            effectiveTo={props.grade.effectiveTo}
          />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-grade-code">コード</FieldLabel>

              <Input
                id="edit-grade-code"
                name="code"
                defaultValue={props.grade.code}
                maxLength={FORM_CONSTRAINTS.grade.codeMax}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-grade-name">名称</FieldLabel>

              <Input
                id="edit-grade-name"
                name="name"
                defaultValue={props.grade.name}
                maxLength={FORM_CONSTRAINTS.grade.nameMax}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-grade-rank">ランク</FieldLabel>

              <Input
                id="edit-grade-rank"
                name="rank"
                type="number"
                inputMode="numeric"
                defaultValue={props.grade.rank ?? ""}
                min={FORM_CONSTRAINTS.grade.rankMin}
                max={FORM_CONSTRAINTS.grade.rankMax}
                step={1}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-grade-description">説明（任意）</FieldLabel>

              <Textarea
                id="edit-grade-description"
                name="description"
                defaultValue={props.grade.description ?? ""}
                maxLength={FORM_CONSTRAINTS.grade.descriptionMax}
              />
            </Field>

            {state.error !== null ? <FieldError>{state.error}</FieldError> : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? "更新中..." : "変更を保存"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
