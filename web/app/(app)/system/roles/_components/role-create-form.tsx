"use client"

import { useRouter } from "next/navigation"
import { startTransition, useActionState, useRef, useState } from "react"
import type { FormEvent } from "react"
import { toast } from "sonner"
import { createRoleAction } from "@/app/(app)/system/roles/actions"
import type { RoleCreateFormState } from "@/app/(app)/system/roles/actions"
import { StepUpDialog } from "@/components/step-up-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type PermissionOption = {
  key: string
  description: string
  category: string
}

type Props = {
  permissions: ReadonlyArray<PermissionOption>
}

const initialState: RoleCreateFormState = { kind: "idle" }

/**
 * 動的ロール作成フォーム。キー・名前・説明と、付与する権限をチェックボックスで選ぶ。
 * 権限はカテゴリごとにまとめて表示する。成功時は一覧へ遷移し、失敗の理由はフォーム内に出す。
 */
export function RoleCreateForm(props: Props) {
  const router = useRouter()

  const [isStepUpOpen, setStepUpOpen] = useState(false)

  // 再認証を挟んだあと同じ入力で再送するため、送信した FormData を持っておく。
  const submittedFormData = useRef<FormData | null>(null)

  async function reduce(
    previousState: RoleCreateFormState,
    formData: FormData,
  ): Promise<RoleCreateFormState> {
    const result = await createRoleAction(previousState, formData)

    if (result.kind === "succeeded") {
      toast.success("ロールを作成しました")

      router.push("/system/roles")
    }

    if (result.kind === "step_up_required") {
      setStepUpOpen(true)
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  // form の action prop を使うと React が送信後にフォームをリセットし、失敗しても入力が消える。
  // 自前の onSubmit から transition 内で action を呼ぶことで、入力を保ったまま結果を受け取る。
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

  const categories = [...new Set(props.permissions.map((permission) => permission.category))]

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-8">
        <Field>
          <FieldLabel htmlFor="key">キー（名前空間:名前、不変）</FieldLabel>
          <Input
            id="key"
            name="key"
            required
            minLength={3}
            maxLength={100}
            pattern="[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*"
            placeholder="company:auditor"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="name">名前</FieldLabel>
          <Input id="name" name="name" required maxLength={100} placeholder="監査担当" />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">説明（任意）</FieldLabel>
          <Input id="description" name="description" maxLength={1000} />
        </Field>

        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium">付与する権限</p>

          {categories.map((category) => (
            <div key={category} className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">{category}</p>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {props.permissions
                  .filter((permission) => permission.category === category)
                  .map((permission) => (
                    <label key={permission.key} className="flex items-center gap-2 text-sm">
                      <Checkbox name="permission_keys" value={permission.key} />

                      <span className="font-mono text-xs">{permission.key}</span>

                      <span className="text-muted-foreground">{permission.description}</span>
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {state.kind === "failed" ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" disabled={isPending} className="self-start">
          {isPending ? "作成中…" : "ロールを作成"}
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
