import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readAuditDisclosurePolicy } from "@/api/http/operations-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { AuditDisclosureCurrent } from "@/components/app/operations-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const requested = c.req.query("scope") ?? "*"
  // 全員向け（*）か、一つのアカウントの番号だけを受け付ける。
  const scope = /^[0-9a-f-]{36}$/i.test(requested) ? requested : "*"
  const user = getUser()
  if (user === null) {
    const next =
      scope === "*" ? "/operations/audit/disclosure" : `/operations/audit/disclosure?scope=${scope}`
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const [profile, policy] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readAuditDisclosurePolicy<AuditDisclosureCurrent>(
      c,
      `/system/audit-disclosure-policies?scope=${encodeURIComponent(scope)}`,
    ),
  ])
  return { email: user.email, pathname: "/operations", scope, initial: { profile, policy } }
})

export const head = defineHead(() => ({
  title: "監査の開示の方針",
  bodyAttrs: { "data-shell": "app" },
}))
