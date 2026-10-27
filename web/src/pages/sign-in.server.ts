import { defineHandler, type InferProps } from "void"
import { readSignInMethod } from "@/api/http/auth/sign-in-method"
import { sameOriginPath } from "@/api/http/auth/same-origin-path"

export type Props = InferProps<typeof loader>

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  denied: "サインインが取り消されました。",
  invalid_state: "サインインの有効期限が切れました。もう一度やり直してください。",
  failed: "サインインできませんでした。もう一度やり直してください。",
  no_account: "このIDで使えるアカウントがありません。管理者に確認してください。",
  unavailable: "サインインを今は使えません。しばらく待ってからやり直してください。",
}

export const loader = defineHandler((c) => {
  const reason = c.req.query("error")
  return {
    // 戻り先は同じoriginの経路だけにし、外部サイトへのリダイレクトに使わせない。
    next: sameOriginPath(c.req.query("next")),
    method: readSignInMethod(c.env),
    error: reason === undefined ? null : (ERROR_MESSAGES[reason] ?? ERROR_MESSAGES.failed),
  }
})
