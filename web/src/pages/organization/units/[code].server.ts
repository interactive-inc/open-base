import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  companyOrganizationId,
  readOrganizationUnit,
  readOrganizationUnitMembers,
  readOrganizationUnits,
} from "@/api/http/organization-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { OrganizationMember, OrganizationUnit } from "@/components/app/organization-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const code = c.req.param("code") ?? ""
  const path = `/organization/units/${encodeURIComponent(code)}`
  const user = getUser()
  if (user === null) return c.redirect(`/sign-in?next=${encodeURIComponent(path)}`)
  const encoded = encodeURIComponent(code)
  const [profile, unit, units, members] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readOrganizationUnit<OrganizationUnit>(c, `/company/organization-units/${encoded}`),
    readOrganizationUnits<OrganizationUnit[]>(c),
    readOrganizationUnitMembers<OrganizationMember[]>(
      c,
      `/company/organization-units/${encoded}/members`,
    ),
  ])
  return {
    email: user.email,
    pathname: "/organization",
    organizationId: companyOrganizationId(),
    code,
    initial: { profile, unit, units, members },
  }
})

export const head = defineHead(() => ({
  title: "組織単位",
  bodyAttrs: { "data-shell": "app" },
}))
