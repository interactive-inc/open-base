import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readRoles } from "@/api/http/accounts-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { RoleList } from "@/components/app/accounts-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Faccounts%2Froles")
  const [profile, roles] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readRoles<RoleList>(c),
  ])
  return { email: user.email, pathname: "/accounts", initial: { profile, roles } }
})

export const head = defineHead(() => ({
  title: "ロール",
  bodyAttrs: { "data-shell": "app" },
}))
