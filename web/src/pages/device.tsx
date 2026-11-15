import { CheckCircle2Icon, KeyRoundIcon, XCircleIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import { AuthFrame } from "@/components/app/auth-frame"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { loadAuthClient } from "@/client/load-auth-client"
import type { Props } from "./device.server"

type Step = "confirm" | "approved" | "denied"

/**
 * CLIの base login が表示したコードを承認する。
 * 承認の直前に必ずサインインし直す。パスキーはその場で、OIDCはIdPで認証し直してこの画面へ戻る。
 * サーバーも直前のサインインでなければ承認を拒否する。
 */
/** サイドバーを出さないレイアウトを使う。 */
export const layout = "bare"

export default function Device({ userCode, method, freshlySignedIn }: Props) {
  const [code, setCode] = useState(userCode ?? "")
  const [step, setStep] = useState<Step>("confirm")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const decide = async (approve: boolean) => {
    setPending(true)
    setError("")
    try {
      const { authClient, describeAuthError } = await loadAuthClient()
      if (method === "passkey") {
        const signedIn = await authClient.signIn.passkey()
        if (signedIn?.error) {
          setError(describeAuthError(signedIn.error))
          return
        }
      }
      const userCode = code.trim().toUpperCase()
      // サインインしたAccountへコードを結び付けてから、承認か拒否を記録する。
      const verified = await authClient.device({ query: { user_code: userCode } })
      if (verified.error) {
        setError(describeAuthError(verified.error))
        return
      }
      const result = approve
        ? await authClient.device.approve({ userCode })
        : await authClient.device.deny({ userCode })
      if (result.error) {
        setError(describeAuthError(result.error))
        return
      }
      setStep(approve ? "approved" : "denied")
    } catch {
      setError("処理できませんでした。もう一度やり直してください。")
    } finally {
      setPending(false)
    }
  }

  if (step !== "confirm") {
    return (
      <AuthFrame
        title={step === "approved" ? "承認しました" : "拒否しました"}
        description={
          <span className="flex items-center gap-2">
            {step === "approved" ? (
              <CheckCircle2Icon aria-hidden="true" className="size-4" />
            ) : (
              <XCircleIcon aria-hidden="true" className="size-4" />
            )}
            ターミナルに戻ってください。
          </span>
        }
      />
    )
  }

  if (method === null) {
    return (
      <AuthFrame
        title="CLIのログイン"
        error="サインインの方式が正しく設定されていません。管理者に確認してください。"
      />
    )
  }

  // OIDCでは、まずIdPでサインインし直してからこの画面で承認する。
  const needsSignIn = method !== "passkey" && !freshlySignedIn
  const returnTo = `/device?user_code=${encodeURIComponent(code.trim().toUpperCase())}`
  const oidcSignInHref = `/api/auth/oidc/sign-in?prompt=login&callbackURL=${encodeURIComponent(returnTo)}`
  const signInHref =
    method === "oidc" ? oidcSignInHref : `/sign-in?next=${encodeURIComponent(returnTo)}`
  const blank = code.trim() === ""

  return (
    <AuthFrame
      title="CLIのログイン"
      description="ターミナルに表示されたコードと同じか確かめてから承認してください。"
      error={error}
    >
      <Field>
        <FieldLabel>コード</FieldLabel>
        <Input
          value={code}
          onValueChange={(value) => setCode(value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
        <FieldDescription>承認すると、このアカウントでCLIを使えるようになります。</FieldDescription>
      </Field>
      {needsSignIn ? (
        <Button className="w-full" render={<Link href={signInHref} />}>
          サインインし直して続ける
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full"
            disabled={pending || blank}
            onClick={() => decide(true)}
            data-agent-confirm="このアカウントでCLIを使えるようにします"
          >
            {pending ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              method === "passkey" && <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
            )}
            {method === "passkey" ? "パスキーで承認" : "承認"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={pending || blank}
            onClick={() => decide(false)}
          >
            拒否
          </Button>
        </div>
      )}
    </AuthFrame>
  )
}
