import { defineHandler, type InferProps } from "void"
import { getSession } from "void/auth"
import { isFreshSignInSession } from "@/api/http/auth/auth-session-method"
import { readSignInMethod } from "@/api/http/auth/sign-in-method"

export type Props = InferProps<typeof loader>

export const loader = defineHandler((c) => {
  const state = getSession()
  return {
    userCode: c.req.query("user_code") ?? null,
    method: readSignInMethod(c.env),
    // OIDCでは承認の直前にIdPでサインインし直して、この画面へ戻ってくる。
    freshlySignedIn: state !== null && isFreshSignInSession(state.session, new Date()),
  }
})
