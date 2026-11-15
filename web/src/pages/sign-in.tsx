import { KeyRoundIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import { AuthFrame } from "@/components/app/auth-frame"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  PasswordInput,
  PasswordInputControl,
  PasswordInputToggle,
} from "@/components/ui/password-input"
import { Spinner } from "@/components/ui/spinner"
import { loadAuthClient } from "@/client/load-auth-client"
import type { Props } from "./sign-in.server"

/** サイドバーを出さないレイアウトを使う。 */
export const layout = "bare"

export default function SignIn({ next, method, error: initialError }: Props) {
  if (method === null) {
    return (
      <AuthFrame
        title="サインイン"
        error="サインインの方式が正しく設定されていません。管理者に確認してください。"
      />
    )
  }

  if (method === "password") return <PasswordSignIn next={next} initialError={initialError} />

  if (method === "oidc") return <OidcSignIn next={next} initialError={initialError} />

  return <PasskeySignIn next={next} initialError={initialError} />
}

type MethodProps = { next: string; initialError: string | null }

function PasskeySignIn({ next, initialError }: MethodProps) {
  const [error, setError] = useState(initialError ?? "")
  const [pending, setPending] = useState(false)

  return (
    <AuthFrame
      title="サインイン"
      description="登録したパスキーでサインインします。"
      error={error}
      footer="パスキーを失くしたときは、管理者に招待の再発行を依頼してください。"
    >
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError("")
          try {
            const { authClient, describeAuthError } = await loadAuthClient()
            const result = await authClient.signIn.passkey()
            if (result?.error) {
              setError(describeAuthError(result.error))
              return
            }
            window.location.assign(next)
          } catch {
            setError("サインインできませんでした。もう一度やり直してください。")
          } finally {
            setPending(false)
          }
        }}
      >
        {pending ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : (
          <KeyRoundIcon data-icon="inline-start" aria-hidden="true" />
        )}
        パスキーでサインイン
      </Button>
    </AuthFrame>
  )
}

function OidcSignIn({ next, initialError }: MethodProps) {
  const href = `/api/auth/oidc/sign-in?callbackURL=${encodeURIComponent(next)}`
  return (
    <AuthFrame
      title="サインイン"
      description="組織のアカウントでサインインします。"
      error={initialError ?? ""}
    >
      <Button className="w-full" render={<Link href={href} reloadDocument />}>
        組織のアカウントでサインイン
      </Button>
    </AuthFrame>
  )
}

function PasswordSignIn({ next, initialError }: MethodProps) {
  const [error, setError] = useState(initialError ?? "")
  const [pending, setPending] = useState(false)

  return (
    <AuthFrame
      title="サインイン"
      description="メールアドレスとパスワードを入力します。"
      error={error}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const email = form.get("email")
          const password = form.get("password")
          if (typeof email !== "string" || typeof password !== "string") return
          setPending(true)
          setError("")
          try {
            const { authClient, describeAuthError } = await loadAuthClient()
            const result = await authClient.signIn.email({ email, password })
            if (result.error) {
              setError(describeAuthError(result.error))
              return
            }
            window.location.assign(next)
          } catch {
            setError("サインインできませんでした。もう一度やり直してください。")
          } finally {
            setPending(false)
          }
        }}
      >
        <FieldGroup>
          <Field name="email" disabled={pending}>
            <FieldLabel>メールアドレス</FieldLabel>
            <Input type="email" autoComplete="username" placeholder="you@example.com" required />
          </Field>
          <Field name="password" disabled={pending}>
            <FieldLabel>パスワード</FieldLabel>
            <PasswordInput autoComplete="current-password" required>
              <PasswordInputControl />
              <PasswordInputToggle />
            </PasswordInput>
          </Field>
        </FieldGroup>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending && <Spinner data-icon="inline-start" aria-hidden="true" />}
          {pending ? "確認しています…" : "サインイン"}
        </Button>
      </form>
    </AuthFrame>
  )
}
