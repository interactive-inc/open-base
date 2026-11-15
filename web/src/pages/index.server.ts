import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readApplicationInbox, readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { InboxList } from "@/components/app/application-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  // サインイン前は画面を描かず、サインインの後にここへ戻す。
  if (user === null) return c.redirect("/sign-in?next=%2F")
  // 最初の表示に要るデータをここで読み、画面が空のまま出て後から書き換わるのを防ぐ。
  const [profile, inbox] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readApplicationInbox<InboxList>(c, "/company/application-requests/inbox?sort=created_at_asc"),
  ])
  return { email: user.email, pathname: "/", initial: { profile, inbox } }
})

export const head = defineHead(() => ({
  title: "承認",
  bodyAttrs: { "data-shell": "app" },
}))
