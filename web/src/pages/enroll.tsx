import { CheckCircle2, KeyRound } from "lucide-react"
import { useState } from "react"
import { AuthFrame } from "@/components/app/auth-frame"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { loadAuthClient } from "@/client/load-auth-client"
import type { Props } from "./enroll.server"

/** 管理者が発行した招待で、最初のパスキーを登録してそのままサインインする。 */
export default function Enroll({ token }: Props) {
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  if (token === null) {
    return (
      <AuthFrame
        title="パスキーの登録"
        description="管理者から受け取った招待のURLを開いてください。"
      />
    )
  }

  if (done) {
    return (
      <AuthFrame
        title="パスキーを登録しました"
        description="次回からこのパスキーでサインインします。"
      >
        <Button size="lg" className="w-full" nativeButton={false} render={<a href="/" />}>
          <CheckCircle2 />
          はじめる
        </Button>
      </AuthFrame>
    )
  }

  return (
    <AuthFrame
      title="パスキーの登録"
      description="この端末かパスワード管理アプリにパスキーを作り、サインインに使います。"
      error={error}
    >
      <Button
        type="button"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={async () => {
          setPending(true)
          setError("")
          try {
            const { authClient, describeAuthError } = await loadAuthClient()
            const result = await authClient.passkey.addPasskey({
              context: token,
              createSession: true,
            })
            if (result?.error) {
              setError(describeAuthError(result.error))
              return
            }
            setDone(true)
          } catch {
            setError("登録できませんでした。もう一度やり直してください。")
          } finally {
            setPending(false)
          }
        }}
      >
        {pending ? <Spinner /> : <KeyRound />}
        パスキーを登録
      </Button>
    </AuthFrame>
  )
}
