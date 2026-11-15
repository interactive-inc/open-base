import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readApplicationTemplates, readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { TemplateList } from "@/components/app/application-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Fapplications%2Ftemplates")
  const [profile, templates] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readApplicationTemplates<TemplateList>(c, "/company/application-templates?limit=100"),
  ])
  return { email: user.email, pathname: "/applications", initial: { profile, templates } }
})

export const head = defineHead(() => ({
  title: "申請のテンプレート",
  bodyAttrs: { "data-shell": "app" },
}))
