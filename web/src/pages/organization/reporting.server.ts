import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { companyOrganizationId, readOrganizationUnits } from "@/api/http/organization-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { OrganizationUnit } from "@/components/app/organization-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const requested = c.req.query("employee") ?? ""
  // 従業員番号として読めない値は、まだ選んでいない状態として扱う。
  const employeeCode = /^\S{1,255}$/.test(requested) ? requested : null
  const user = getUser()
  if (user === null) {
    const next =
      employeeCode === null
        ? "/organization/reporting"
        : `/organization/reporting?employee=${encodeURIComponent(employeeCode)}`
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const [profile, units] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readOrganizationUnits<OrganizationUnit[]>(c),
  ])
  return {
    email: user.email,
    pathname: "/organization",
    organizationId: companyOrganizationId(),
    employeeCode,
    initial: { profile, units },
  }
})

export const head = defineHead(() => ({
  title: "報告ラインと判断資格",
  bodyAttrs: { "data-shell": "app" },
}))
