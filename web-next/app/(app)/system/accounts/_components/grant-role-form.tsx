"use client"

import { startTransition, useActionState, useRef, useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"
import { grantAccountRoleAction } from "@/app/(app)/system/accounts/actions"
import type { AccountActionState } from "@/app/(app)/system/accounts/actions"
import { StepUpDialog } from "@/components/step-up-dialog"
import { Button } from "@/components/ui/button"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"

type Props = {
  accountId: string
  roles: ReadonlyArray<{ id: string; key: string }>
}

const initialState: AccountActionState = { kind: "idle" }

/**
 * アカウント行のインライン: ロールを選んで付与する。割当可能なロール一覧から選択する。
 * 再認証を求められたら再入力を挟み、同じロールで付与を再実行する。
 * 表のセル内に置くため、拒否理由は toast で出す。
 */
export function GrantRoleForm(props: Props) {
  const [isStepUpOpen, setStepUpOpen] = useState(false)

  // 再認証を挟んだあと同じ選択で再送するため、送信した FormData を持っておく。
  const submittedFormData = useRef<FormData | null>(null)

  async function reduce(
    previousState: AccountActionState,
    formData: FormData,
  ): Promise<AccountActionState> {
    const result = await grantAccountRoleAction(previousState, formData)

    if (result.kind === "succeeded") {
      toast.success("ロールを付与しました")
    }

    if (result.kind === "step_up_required") {
      setStepUpOpen(true)
    }

    if (result.kind === "failed") {
      toast.error(result.error)
    }

    return result
  }

  const [, formAction, isPending] = useActionState(reduce, initialState)

  // form の action prop を使うと React が送信後にフォームをリセットし、再認証中に選択が消える。
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
    <>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input type="hidden" name="account_id" value={props.accountId} />

        <NativeSelect name="role_id" defaultValue="" aria-label="付与するロール">
          <NativeSelectOption value="" disabled>
            ロールを選択
          </NativeSelectOption>

          {props.roles.map((role) => (
            <NativeSelectOption key={role.id} value={role.id}>
              {role.key}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <Button type="submit" size="sm" variant="secondary" disabled={isPending}>
          付与
        </Button>
      </form>

      <StepUpDialog
        open={isStepUpOpen}
        onSucceeded={handleStepUpSucceeded}
        onCancel={() => setStepUpOpen(false)}
      />
    </>
  )
}
