import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile, readMyApplications } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { MyApplicationList } from "@/components/app/application-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Fapplications")
  const [profile, applications] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readMyApplications<MyApplicationList>(c),
  ])
  return { email: user.email, pathname: "/applications", initial: { profile, applications } }
})

export const head = defineHead(() => ({
  title: "申請",
  bodyAttrs: { "data-shell": "app" },
}))
