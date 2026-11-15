import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { companyOrganizationId } from "@/api/http/organization-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Forganization%2Fgrades")
  // 等級の定義は組織IDのヘッダーが要るため、ブラウザーで読む。
  const profile = await readCurrentProfile<CurrentProfile>(c)
  return {
    email: user.email,
    pathname: "/organization",
    organizationId: companyOrganizationId(),
    initial: { profile },
  }
})

export const head = defineHead(() => ({
  title: "等級",
  bodyAttrs: { "data-shell": "app" },
}))
