"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"
import { setAccountStatusAction } from "@/app/(app)/system/accounts/actions"
import type { AccountActionState } from "@/app/(app)/system/accounts/actions"
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

const initialState: AccountActionState = { kind: "idle" }

type Props = {
  accountId: string
  status: string
}

/**
 * アカウントを停止/有効化するボタン。active なら停止、それ以外は有効化を出す。
 * 再認証を求められたら確認ダイアログを閉じて再入力を挟み、同じ変更を再実行する。
 * modal を重ねると背面の dialog が focus を握ったままになるため、同時には開かない。
 */
export function AccountStatusButton(props: Props) {
  const [isConfirmOpen, setConfirmOpen] = useState(false)

  const [isStepUpOpen, setStepUpOpen] = useState(false)

  // 再認証を挟んだあと同じ対象で再送するため、送信した FormData を持っておく。
  const submittedFormData = useRef<FormData | null>(null)

  const isSuspend = props.status === "active"

  async function reduce(
    previousState: AccountActionState,
    formData: FormData,
  ): Promise<AccountActionState> {
    const result = await setAccountStatusAction(previousState, formData)

    if (result.kind === "succeeded") {
      toast.success("状態を変更しました")

      setConfirmOpen(false)
    }

    if (result.kind === "step_up_required") {
      setConfirmOpen(false)

      setStepUpOpen(true)
    }

    // 停止は確認ダイアログの中に理由を戻す。有効化は表のセル内なので toast で出す。
    if (result.kind === "failed") {
      if (isSuspend) {
        setConfirmOpen(true)
      } else {
        toast.error(result.error)
      }
    }

    return result
  }

  const [state, formAction, isPending] = useActionState(reduce, initialState)

  // 再送を transition の外で呼ぶと isPending が更新されず React が警告する。
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

  const stepUpDialog = (
    <StepUpDialog
      open={isStepUpOpen}
      onSucceeded={handleStepUpSucceeded}
      onCancel={() => setStepUpOpen(false)}
    />
  )

  // 有効化(影響が小さい)は即時、停止(ログイン不可になる)は確認ダイアログを挟む。
  if (isSuspend === false) {
    return (
      <>
        <form onSubmit={handleSubmit} className="inline">
          <input type="hidden" name="account_id" value={props.accountId} />

          <input type="hidden" name="status" value="active" />

          <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
            有効化
          </Button>
        </form>

        {stepUpDialog}
      </>
    )
  }

  return (
    <AlertDialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
      <AlertDialogTrigger render={<Button variant="secondary" size="sm" disabled={isPending} />}>
        停止
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>このアカウントを停止しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            停止するとこのアカウントはログインできなくなり、発行済みのトークンも即時無効になります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        {state.kind === "failed" ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit}>
          <input type="hidden" name="account_id" value={props.accountId} />

          <input type="hidden" name="status" value="suspended" />

          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>

            <Button type="submit" variant="destructive" disabled={isPending}>
              停止する
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>

      {stepUpDialog}
    </AlertDialog>
  )
}
