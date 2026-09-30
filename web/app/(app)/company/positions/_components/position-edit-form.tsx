"use client"

import { PositionRevisionFields } from "@/app/(app)/company/positions/_components/position-revision-fields"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { updatePositionAction } from "@/app/(app)/company/positions/actions"
import type { PositionActionState } from "@/app/(app)/company/positions/actions"
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
import type { PositionResponse } from "@/lib/api/types/position-types"
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  position: PositionResponse
}

const initialState: PositionActionState = { ok: false, error: null }

/** 役職編集フォームを Dialog で開く。コード・名称・ランク・説明を変更して送信する。 */
export function PositionEditForm(props: Props) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: PositionActionState,
    formData: FormData,
  ): Promise<PositionActionState> {
    const result = await updatePositionAction(previousState, formData)

    if (result.ok) {
      toast.success("役職を更新しました")

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
          <DialogTitle>役職を変更</DialogTitle>

          <DialogDescription>コード・名称・ランク・説明を変更します。</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <PositionRevisionFields
            jobId={props.position.jobId}
            id={props.position.id}
            companyRevision={props.position.organizationRevision}
            resourceRevision={props.position.revision}
            commandId={props.position.commandId}
            effectiveFrom={props.position.effectiveFrom}
            effectiveTo={props.position.effectiveTo}
          />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-position-code">コード</FieldLabel>

              <Input
                id="edit-position-code"
                name="code"
                defaultValue={props.position.code}
                maxLength={FORM_CONSTRAINTS.position.codeMax}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-position-name">名称</FieldLabel>

              <Input
                id="edit-position-name"
                name="name"
                defaultValue={props.position.name}
                maxLength={FORM_CONSTRAINTS.position.nameMax}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-position-rank">ランク</FieldLabel>

              <Input
                id="edit-position-rank"
                name="rank"
                type="number"
                inputMode="numeric"
                defaultValue={props.position.rank ?? ""}
                min={FORM_CONSTRAINTS.position.rankMin}
                max={FORM_CONSTRAINTS.position.rankMax}
                step={1}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-position-description">説明（任意）</FieldLabel>

              <Textarea
                id="edit-position-description"
                name="description"
                defaultValue={props.position.description ?? ""}
                maxLength={FORM_CONSTRAINTS.position.descriptionMax}
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
