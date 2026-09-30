"use client"

import { EmployeeProfileFields } from "@/components/employee-profile-fields"
import type { EmployeeProfileVersion } from "@/lib/api/types/employee-profile-version"
import { useActionState, useState } from "react"
import { toast } from "sonner"
import { updateEmployeeAction } from "@/app/(app)/company/employees/actions"
import type { EmployeeUpdateFormState } from "@/app/(app)/company/employees/actions"
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
import { FORM_CONSTRAINTS } from "@/lib/form/constraints"

type Props = {
  profile: EmployeeProfileVersion | null
  commandId: string
  code: string
  name: string
}

const initialState: EmployeeUpdateFormState = { ok: false, error: null }

/**
 * 人物台帳では氏名だけを編集する。所属・役職・在籍状態は人事発令で変更する。
 * 成功・失敗の通知は action の結果を見て toast() で出す（useEffect は使わない）。
 */
export function EmployeeEditForm(props: Props) {
  const [open, setOpen] = useState(false)

  async function reduce(
    previousState: EmployeeUpdateFormState,
    formData: FormData,
  ): Promise<EmployeeUpdateFormState> {
    const result = await updateEmployeeAction(previousState, formData)

    if (result.ok) {
      toast.success("従業員を更新しました")

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

  if (props.profile === null) return <p>人物情報の対応確認が完了するまで編集できません。</p>

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="secondary" size="sm" />}>編集</DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>従業員を編集</DialogTitle>

          <DialogDescription>
            人物台帳の氏名を変更します。所属・役職・在籍状態は人事発令から変更してください。
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="code" value={props.code} />

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="edit-employee-name">氏名</FieldLabel>

              <Input
                id="edit-employee-name"
                name="name"
                defaultValue={props.name}
                autoComplete="name"
                maxLength={FORM_CONSTRAINTS.employee.nameMax}
                required
              />
            </Field>

            <EmployeeProfileFields
              profile={props.profile}
              commandId={props.commandId}
              reasonId="employee-name-change-reason"
            />

            {state.error !== null ? (
              <div aria-live="polite">
                <FieldError>{state.error}</FieldError>
              </div>
            ) : null}

            <Button type="submit" disabled={isPending}>
              {isPending ? "更新中…" : "変更を保存"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
