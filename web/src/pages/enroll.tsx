import { useState } from "react"
import { loadAuthClient } from "@/client/load-auth-client"
import type { Props } from "./enroll.server"

/** 管理者が発行した招待で、最初のパスキーを登録してそのままサインインする。 */
export default function Enroll({ token }: Props) {
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  if (token === null) {
    return (
      <>
        <h1>パスキーの登録</h1>
        <p>招待のURLを開いてください。</p>
      </>
    )
  }

  if (done) {
    return (
      <>
        <h1>パスキーを登録しました</h1>
        <p>
          <a href="/">はじめる</a>
        </p>
      </>
    )
  }

  return (
    <>
      <h1>パスキーの登録</h1>
      <p>この端末かパスワード管理アプリにパスキーを作り、サインインに使います。</p>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError("")
          const { authClient, describeAuthError } = await loadAuthClient()
          const result = await authClient.passkey.addPasskey({
            context: token,
            createSession: true,
          })
          setPending(false)
          if (result?.error) {
            setError(describeAuthError(result.error))
            return
          }
          setDone(true)
        }}
      >
        パスキーを登録
      </button>
      {error !== "" && <p role="alert">{error}</p>}
    </>
  )
}
