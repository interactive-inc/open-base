import { useState } from "react"
import { loadAuthClient } from "@/client/load-auth-client"
import type { Props } from "./index.server"

export default function Home({ email }: Props) {
  const [signedOut, setSignedOut] = useState(false)

  if (email === null || signedOut) {
    return (
      <>
        <h1>Base</h1>
        <p>
          <a href="/sign-in">パスキーでサインイン</a>
        </p>
      </>
    )
  }

  return (
    <>
      <h1>Base</h1>
      <p>{email} でサインインしています。</p>
      <button
        type="button"
        onClick={async () => {
          const { authClient } = await loadAuthClient()
          await authClient.signOut()
          setSignedOut(true)
        }}
      >
        サインアウト
      </button>
    </>
  )
}
