import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readPrincipals } from "@/api/http/accounts-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { PrincipalList } from "@/components/app/accounts-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Faccounts%2Fprincipals")
  const [profile, principals] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readPrincipals<PrincipalList>(c),
  ])
  return { email: user.email, pathname: "/accounts", initial: { profile, principals } }
})

export const head = defineHead(() => ({
  title: "Principal",
  bodyAttrs: { "data-shell": "app" },
}))
