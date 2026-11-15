import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { companyOrganizationId } from "@/api/http/organization-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"

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
        ? "/organization/grades/assignments"
        : `/organization/grades/assignments?employee=${encodeURIComponent(employeeCode)}`
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  // 割当と履歴は組織IDのヘッダーが要るため、ブラウザーで読む。
  const profile = await readCurrentProfile<CurrentProfile>(c)
  return {
    email: user.email,
    pathname: "/organization",
    organizationId: companyOrganizationId(),
    employeeCode,
    initial: { profile },
  }
})

export const head = defineHead(() => ({
  title: "等級の割当",
  bodyAttrs: { "data-shell": "app" },
}))
