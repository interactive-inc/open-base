import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler((c) => {
  const user = getUser()
  // サインイン前はダッシュボードを描かず、サインインの後にここへ戻す。
  if (user === null) return c.redirect("/sign-in?next=%2F")
  return { email: user.email, pathname: "/" }
})

export const head = defineHead(() => ({ title: "ダッシュボード" }))
