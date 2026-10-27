import { useState } from "react"
import { loadAuthClient } from "@/client/load-auth-client"
import type { Props } from "./device.server"

type Step = "confirm" | "approved" | "denied"

/**
 * CLIの base login が表示したコードを承認する。
 * 承認の直前に必ずサインインし直す。パスキーはその場で、OIDCはIdPで認証し直してこの画面へ戻る。
 * サーバーも直前のサインインでなければ承認を拒否する。
 */
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
      <>
        <h1>{step === "approved" ? "承認しました" : "拒否しました"}</h1>
        <p>ターミナルに戻ってください。</p>
      </>
    )
  }

  if (method === null) {
    return (
      <>
        <h1>CLIのログイン</h1>
        <p role="alert">サインインの方式が正しく設定されていません。管理者に確認してください。</p>
      </>
    )
  }

  // OIDCでは、まずIdPでサインインし直してからこの画面で承認する。
  const needsSignIn = method !== "passkey" && !freshlySignedIn
  const returnTo = `/device?user_code=${encodeURIComponent(code.trim().toUpperCase())}`
  const oidcSignInHref = `/api/auth/oidc/sign-in?prompt=login&callbackURL=${encodeURIComponent(returnTo)}`
  const approveLabel = method === "passkey" ? "パスキーで承認" : "承認"

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
      {needsSignIn ? (
        <p>
          <a
            href={
              method === "oidc" ? oidcSignInHref : `/sign-in?next=${encodeURIComponent(returnTo)}`
            }
          >
            サインインし直して続ける
          </a>
        </p>
      ) : (
        <p>
          <button
            type="button"
            disabled={pending || code.trim() === ""}
            onClick={() => decide(true)}
          >
            {approveLabel}
          </button>{" "}
          <button
            type="button"
            disabled={pending || code.trim() === ""}
            onClick={() => decide(false)}
          >
            拒否
          </button>
        </p>
      )}
      {error !== "" && <p role="alert">{error}</p>}
    </>
  )
}
