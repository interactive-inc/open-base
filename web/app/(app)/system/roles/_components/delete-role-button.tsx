"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"
import { deleteRoleAction } from "@/app/(app)/system/roles/actions"
import type { RoleDeleteFormState } from "@/app/(app)/system/roles/actions"
import { StepUpDialog } from "@/components/step-up-dialog"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

type Props = {
  roleId: string
  roleName: string
}

const initialState: RoleDeleteFormState = { kind: "idle" }

/**
 * 動的ロールを削除するボタン。削除前に確認ダイアログを挟む。system role には表示しない。
 * 再認証を求められたら確認ダイアログを閉じて再入力を挟み、同じ削除を再実行する。
 * modal を重ねると背面の dialog が focus を握ったままになるため、同時には開かない。
 */
export function DeleteRoleButton(props: Props) {
  const [isConfirmOpen, setConfirmOpen] = useState(false)

  const [isStepUpOpen, setStepUpOpen] = useState(false)

  // 再認証を挟んだあと同じ対象で再送するため、送信した FormData を持っておく。
  const submittedFormData = useRef<FormData | null>(null)

  async function reduce(
    previousState: RoleDeleteFormState,
    formData: FormData,
  ): Promise<RoleDeleteFormState> {
    const result = await deleteRoleAction(previousState, formData)

    if (result.kind === "succeeded") {
      toast.success("ロールを削除しました")

      setConfirmOpen(false)
    }

    if (result.kind === "step_up_required") {
      setConfirmOpen(false)

      setStepUpOpen(true)
    }

    // 再認証のあとに拒否された場合、理由は確認ダイアログの中に出す。
    if (result.kind === "failed") {
      setConfirmOpen(true)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  // 再送を transition の外で呼ぶと isPending が更新されず React が警告する。
  // 3つのロールフォームで送信経路を揃えるため、削除も onSubmit から action を呼ぶ。
  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)

    submittedFormData.current = formData

    startTransition(() => formAction(formData))
  }

  function handleStepUpSucceeded(): void {
    setStepUpOpen(false)

    const formData = submittedFormData.current

    if (formData !== null) {
      startTransition(() => formAction(formData))
    }
  }

  return (
    <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogTrigger render={<Button variant="secondary" size="sm" disabled={isPending} />}>
        削除
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ロール「{props.roleName}」を削除しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            この操作は取り消せません。割当中のロールは削除できません。
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.kind === "failed" ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="role_id" value={props.roleId} />

          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>

            <Button type="submit" variant="destructive" disabled={isPending}>
              削除する
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>

      <StepUpDialog
        open={isStepUpOpen}
        onSucceeded={handleStepUpSucceeded}
        onCancel={() => setStepUpOpen(false)}
      />
    </AlertDialog>
  )
}
