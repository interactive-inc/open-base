import { useState } from "react"
import { loadAuthClient } from "@/client/load-auth-client"
import type { Props } from "./device.server"

type Step = "confirm" | "approved" | "denied"

/**
 * CLIの base login が表示したコードを承認する。
 * 承認の直前に必ずパスキーでサインインし直す。サーバーも直前のサインインでなければ承認を拒否する。
 */
export default function Device({ userCode }: Props) {
  const [code, setCode] = useState(userCode ?? "")
  const [step, setStep] = useState<Step>("confirm")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  const decide = async (approve: boolean) => {
    setPending(true)
    setError("")
    const { authClient, describeAuthError } = await loadAuthClient()
    const signedIn = await authClient.signIn.passkey()
    if (signedIn?.error) {
      setPending(false)
      setError(describeAuthError(signedIn.error))
      return
    }
    const userCode = code.trim().toUpperCase()
    // サインインしたAccountへコードを結び付けてから、承認か拒否を記録する。
    const verified = await authClient.device({ query: { user_code: userCode } })
    if (verified.error) {
      setPending(false)
      setError(describeAuthError(verified.error))
      return
    }
    const result = approve
      ? await authClient.device.approve({ userCode })
      : await authClient.device.deny({ userCode })
    setPending(false)
    if (result.error) {
      setError(describeAuthError(result.error))
      return
    }
    setStep(approve ? "approved" : "denied")
  }

  if (step !== "confirm") {
    return (
      <>
        <h1>{step === "approved" ? "承認しました" : "拒否しました"}</h1>
        <p>ターミナルに戻ってください。</p>
      </>
    )
  }

  return (
    <>
      <h1>CLIのログイン</h1>
      <p>ターミナルに表示されたコードと同じか確かめてから承認してください。</p>
      <label>
        コード
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoComplete="off"
          style={{ display: "block", fontSize: "1.5rem", letterSpacing: "0.1em" }}
        />
      </label>
      <p>
        <button type="button" disabled={pending || code.trim() === ""} onClick={() => decide(true)}>
          パスキーで承認
        </button>{" "}
        <button
          type="button"
          disabled={pending || code.trim() === ""}
          onClick={() => decide(false)}
        >
          拒否
        </button>
      </p>
      {error !== "" && <p role="alert">{error}</p>}
    </>
  )
}
