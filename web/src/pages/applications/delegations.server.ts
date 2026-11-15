import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  readApplicationTemplates,
  readApprovalDelegations,
  readCurrentProfile,
} from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { DelegationList, TemplateList } from "@/components/app/application-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Fapplications%2Fdelegations")
  const [profile, delegations, templates] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readApprovalDelegations<DelegationList>(c),
    readApplicationTemplates<TemplateList>(c, "/company/application-templates?limit=100"),
  ])
  return {
    email: user.email,
    pathname: "/applications",
    initial: { profile, delegations, templates },
  }
})

export const head = defineHead(() => ({
  title: "承認の代理",
  bodyAttrs: { "data-shell": "app" },
}))
