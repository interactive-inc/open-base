import { useState } from "react"
import { loadAuthClient } from "@/client/load-auth-client"
import type { Props } from "./sign-in.server"

export default function SignIn({ next }: Props) {
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

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
          const { authClient, describeAuthError } = await loadAuthClient()
          const result = await authClient.signIn.passkey()
          setPending(false)
          if (result?.error) {
            setError(describeAuthError(result.error))
            return
          }
          window.location.assign(next)
        }}
      >
        パスキーでサインイン
      </button>
      {error !== "" && <p role="alert">{error}</p>}
      <p>パスキーを失くしたときは、管理者に招待の再発行を依頼してください。</p>
    </>
  )
}
