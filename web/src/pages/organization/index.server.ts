import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  companyOrganizationId,
  readMyOrganizationUnits,
  readOrganizationTree,
} from "@/api/http/organization-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { MyOrganizationUnits, OrganizationTreeNode } from "@/components/app/organization-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Forganization")
  const [profile, tree, myUnits] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readOrganizationTree<OrganizationTreeNode[]>(c),
    readMyOrganizationUnits<MyOrganizationUnits>(c),
  ])
  return {
    email: user.email,
    pathname: "/organization",
    organizationId: companyOrganizationId(),
    initial: { profile, tree, myUnits },
  }
})

export const head = defineHead(() => ({
  title: "組織",
  bodyAttrs: { "data-shell": "app" },
}))
