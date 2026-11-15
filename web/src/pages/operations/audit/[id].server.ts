import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCompanyAuditEvent, readSystemAuditEvent } from "@/api/http/operations-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { CompanyAuditDetail, SystemAuditEvent } from "@/components/app/operations-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  const ledger = c.req.query("ledger") === "system" ? "system" : "company"
  // 記録の番号として読めない値はAPIへ渡さず、見つからない扱いにする。
  const valid = /^[A-Za-z0-9_.:-]{1,256}$/.test(id)
  const user = getUser()
  if (user === null) {
    const next = valid
      ? `/operations/audit/${id}${ledger === "system" ? "?ledger=system" : ""}`
      : "/operations/audit"
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const forbidden = { kind: "forbidden" } as const
  const [profile, company, system] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    ledger !== "company"
      ? null
      : valid
        ? readCompanyAuditEvent<CompanyAuditDetail>(c, `/company/audit-events/${id}`)
        : forbidden,
    ledger !== "system"
      ? null
      : valid
        ? readSystemAuditEvent<SystemAuditEvent>(c, `/system/audit-events/${id}`)
        : forbidden,
  ])
  return {
    email: user.email,
    pathname: "/operations",
    id,
    ledger,
    initial: { profile, company, system },
  }
})

export const head = defineHead(() => ({
  title: "監査の記録の詳細",
  bodyAttrs: { "data-shell": "app" },
}))
