import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readWorkItems } from "@/api/http/operations-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { WorkItemPage } from "@/components/app/operations-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Foperations%2Fwork-items")
  const [profile, workItems] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readWorkItems<WorkItemPage>(c, "/system/work-items?limit=50"),
  ])
  return { email: user.email, pathname: "/operations", initial: { profile, workItems } }
})

export const head = defineHead(() => ({
  title: "作業の依頼",
  bodyAttrs: { "data-shell": "app" },
}))
