"use client"

import { X } from "lucide-react"
import { startTransition, useActionState, useRef, useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"
import { revokeAccountRoleAction } from "@/app/(app)/system/accounts/actions"
import type { AccountActionState } from "@/app/(app)/system/accounts/actions"
import { StepUpDialog } from "@/components/step-up-dialog"
import { Button } from "@/components/ui/button"

const initialState: AccountActionState = { kind: "idle" }

type Props = {
  accountId: string
  bindingId: string
  roleLabel: string
}

/**
 * ロール名を表示し、押すとそのロールをアカウントから剥奪するボタン。
 * 再認証を求められたら再入力を挟み、同じ剥奪を再実行する。
 * 表のセル内に並ぶため、拒否理由は toast で出す。
 */
export function RevokeRoleButton(props: Props) {
  const [isStepUpOpen, setStepUpOpen] = useState(false)

  // 再認証を挟んだあと同じ対象で再送するため、送信した FormData を持っておく。
  const submittedFormData = useRef<FormData | null>(null)

  async function reduce(
    previousState: AccountActionState,
    formData: FormData,
  ): Promise<AccountActionState> {
    const result = await revokeAccountRoleAction(previousState, formData)

    if (result.kind === "succeeded") {
      toast.success("ロールを剥奪しました")
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

  return (
    <>
      <form onSubmit={handleSubmit}>
        <input type="hidden" name="account_id" value={props.accountId} />

        <input type="hidden" name="binding_id" value={props.bindingId} />

        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={isPending}
          aria-label={`${props.roleLabel} を剥奪`}
        >
          {props.roleLabel}
          <X data-icon="inline-end" />
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
