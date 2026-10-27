import { useState } from "react"
import { loadAuthClient } from "@/client/load-auth-client"
import type { Props } from "./sign-in.server"

export default function SignIn({ next, method, error: initialError }: Props) {
  const [error, setError] = useState(initialError ?? "")
  const [pending, setPending] = useState(false)

  if (method === null) {
    return (
      <>
        <h1>サインイン</h1>
        <p role="alert">サインインの方式が正しく設定されていません。管理者に確認してください。</p>
      </>
    )
  }

  if (method === "password") return <PasswordSignIn next={next} initialError={initialError} />

  if (method === "oidc") {
    const href = `/api/auth/oidc/sign-in?callbackURL=${encodeURIComponent(next)}`
    return (
      <>
        <h1>サインイン</h1>
        <p>組織のアカウントでサインインします。</p>
        <p>
          <a href={href}>サインイン</a>
        </p>
        {error !== "" && <p role="alert">{error}</p>}
      </>
    )
  }

  return (
    <>
      <h1>サインイン</h1>
      <p>登録したパスキーでサインインします。</p>
      <button
        type="button"
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
        パスキーでサインイン
      </button>
      {error !== "" && <p role="alert">{error}</p>}
      <p>パスキーを失くしたときは、管理者に招待の再発行を依頼してください。</p>
    </>
  )
}

function PasswordSignIn({ next, initialError }: { next: string; initialError: string | null }) {
  const [error, setError] = useState(initialError ?? "")
  const [pending, setPending] = useState(false)
  return (
    <>
      <h1>サインイン</h1>
      <form
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
            const result = await authClient.signIn.email({
              email,
              password,
            })
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
        <p>
          <label>
            メールアドレス{" "}
            <input name="email" type="email" autoComplete="username" required disabled={pending} />
          </label>
        </p>
        <p>
          <label>
            パスワード{" "}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              disabled={pending}
            />
          </label>
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "確認しています…" : "サインイン"}
        </button>
      </form>
      {error !== "" && <p role="alert">{error}</p>}
    </>
  )
}
