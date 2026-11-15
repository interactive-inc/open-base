import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readOrganizationProfile } from "@/api/http/organization-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { OrganizationProfile } from "@/components/app/organization-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Forganization%2Fcompany")
  const [profile, company] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readOrganizationProfile<OrganizationProfile>(c),
  ])
  return { email: user.email, pathname: "/organization", initial: { profile, company } }
})

export const head = defineHead(() => ({
  title: "会社の情報",
  bodyAttrs: { "data-shell": "app" },
}))
