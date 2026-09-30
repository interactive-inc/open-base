"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"
import { resetPasswordAction } from "@/app/(app)/system/accounts/actions"
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
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"

const initialState: AccountActionState = { kind: "idle" }

type Props = {
  accountId: string
}

/**
 * アカウントのパスワードを管理者が再設定するボタン。ダイアログで新パスワードを入力する。
 * 再認証を求められたら入力ダイアログを閉じて再入力を挟み、同じパスワードで再実行する。
 * modal を重ねると背面の dialog が focus を握ったままになるため、同時には開かない。
 */
export function ResetPasswordButton(props: Props) {
  const [isFormOpen, setFormOpen] = useState(false)

  const [isStepUpOpen, setStepUpOpen] = useState(false)

  // 再認証を挟んだあと同じ入力で再送するため、送信した FormData を持っておく。
  const submittedFormData = useRef<FormData | null>(null)

  async function reduce(
    previousState: AccountActionState,
    formData: FormData,
  ): Promise<AccountActionState> {
    const result = await resetPasswordAction(previousState, formData)

    if (result.kind === "succeeded") {
      toast.success("パスワードを再設定しました")

      submittedFormData.current = null

      setFormOpen(false)
    }

    if (result.kind === "step_up_required") {
      setFormOpen(false)

      setStepUpOpen(true)
    }

    // 再認証のあとに拒否された場合も、理由は入力ダイアログの中に出す。
    if (result.kind === "failed") {
      setFormOpen(true)
    }

    return result
  }

  const [state, formAction, isPending] = useActionState(reduce, initialState)

  // form の action prop を使うと React が送信後にフォームをリセットし、失敗しても入力が消える。
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
    <AlertDialog open={isFormOpen} onOpenChange={setFormOpen}>
      <AlertDialogTrigger render={<Button variant="secondary" size="sm" disabled={isPending} />}>
        PW再設定
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>パスワードを再設定しますか？</AlertDialogTitle>

          <AlertDialogDescription>
            新しいパスワードを設定すると、このアカウントの既存トークンは無効になります。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="account_id" value={props.accountId} />

          <Field>
            <FieldLabel htmlFor={`new-password-${props.accountId}`}>新しいパスワード</FieldLabel>

            <Input
              id={`new-password-${props.accountId}`}
              type="password"
              name="new_password"
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={200}
              placeholder="12文字以上で入力…"
            />
          </Field>

          {state.kind === "failed" ? (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>

            <Button type="submit" disabled={isPending}>
              再設定する
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
