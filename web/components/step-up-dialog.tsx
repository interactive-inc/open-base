"use client"

import { useActionState } from "react"
import type { MouseEvent } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { stepUpAction } from "@/lib/auth/step-up-action"
import type { StepUpFormState } from "@/lib/auth/step-up-action"

type Props = {
  open: boolean
  onSucceeded: () => void
  onCancel: () => void
}

const initialState: StepUpFormState = { ok: false, error: null }

const IDENTITY_STEP_UP_PATH = "/auth/broker/login?purpose=step-up"

/**
 * 高リスク操作の直前に再認証させるダイアログ。
 * パスワードで成功すると再認証 grant が cookie に置かれ、呼び出し元が元の操作を再実行する。
 * 外部 identity provider を設定した環境では、そこで認証し直して同じ画面へ戻る経路も出す。
 * 戻った後は 5 分間、元の操作を再認証なしで実行できる。
 */
export function StepUpDialog(props: Props) {
  const identityLoginUrl = process.env.NEXT_PUBLIC_IDENTITY_LOGIN_URL ?? null

  const passwordHidden =
    process.env.NEXT_PUBLIC_PASSWORD_LOGIN_HIDDEN === "1" && identityLoginUrl !== null

  // 戻り先は押した時点の画面にする。描画時の path では query を失い、server 描画にも window が無い。
  function handleIdentityStepUp(event: MouseEvent<HTMLAnchorElement>): void {
    const returnTo = `${window.location.pathname}${window.location.search}`

    event.currentTarget.href = `${IDENTITY_STEP_UP_PATH}&return_to=${encodeURIComponent(returnTo)}`
  }

  async function reduce(
    previousState: StepUpFormState,
    formData: FormData,
  ): Promise<StepUpFormState> {
    const result = await stepUpAction(previousState, formData)

    if (result.ok) {
      props.onSucceeded()
    }

    return result
  }

  const action = useActionState(reduce, initialState)

  const state = action[0]

  const formAction = action[1]

  const isPending = action[2]

  function handleOpenChange(open: boolean): void {
    if (open === false) {
      props.onCancel()
    }
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {passwordHidden
              ? "組織のアカウントで再認証してください"
              : "パスワードを再入力してください"}
          </DialogTitle>

          <DialogDescription>
            この操作には再認証が必要です。確認後 5 分間は続けて操作できます。
          </DialogDescription>
        </DialogHeader>

        {identityLoginUrl !== null ? (
          <Button
            nativeButton={false}
            render={<a href={IDENTITY_STEP_UP_PATH} onClick={handleIdentityStepUp} />}
          >
            組織のアカウントで再認証する
          </Button>
        ) : null}

        {passwordHidden ? null : (
          <form action={formAction} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="step-up-password">パスワード</FieldLabel>

              <Input
                id="step-up-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            {state.error !== null ? (
              <Alert variant="destructive">
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={props.onCancel}>
                やめる
              </Button>

              <Button type="submit" disabled={isPending}>
                {isPending ? "確認中…" : "確認して続行"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
