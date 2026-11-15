import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCompanyAuditEvents, readSystemAuditEvents } from "@/api/http/operations-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  auditApiPath,
  auditPageUrl,
  auditRangeError,
  readAuditQuery,
} from "@/components/app/operations-audit"
import type { CompanyAuditPage, SystemAuditPage } from "@/components/app/operations-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const { ledger, filters } = readAuditQuery(new URL(c.req.url).searchParams)
  const user = getUser()
  if (user === null) {
    return c.redirect(`/sign-in?next=${encodeURIComponent(auditPageUrl(ledger, filters))}`)
  }
  const path = auditApiPath(ledger, filters)
  // 期間が逆のときはAPIへ渡さず、画面で直すよう促す。
  const valid = auditRangeError(filters) === null
  const [profile, company, system] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid && ledger === "company" ? readCompanyAuditEvents<CompanyAuditPage>(c, path) : null,
    valid && ledger === "system" ? readSystemAuditEvents<SystemAuditPage>(c, path) : null,
  ])
  return {
    email: user.email,
    pathname: "/operations",
    ledger,
    filters,
    initial: { profile, company, system },
  }
})

export const head = defineHead(() => ({
  title: "監査の記録",
  bodyAttrs: { "data-shell": "app" },
}))
