import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import { readMyDirectReports, readMyProfile } from "@/api/http/employees-page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { DirectReportList, MyProfile } from "@/components/app/employees-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Fprofile")
  const [profile, myProfile, reports] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readMyProfile<MyProfile>(c),
    readMyDirectReports<DirectReportList>(c),
  ])
  return {
    email: user.email,
    pathname: "/profile",
    initial: { profile, myProfile, reports },
  }
})

export const head = defineHead(() => ({
  title: "あなたの情報",
  bodyAttrs: { "data-shell": "app" },
}))
