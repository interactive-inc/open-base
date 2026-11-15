import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readMachineCredentials, readPrincipal } from "@/api/http/accounts-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { MachineCredentialList, Principal } from "@/components/app/accounts-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  // APIのIDの形（空白を含まない255文字まで）に合わない値は渡さず、見つからない扱いにする。
  const valid = /^[A-Za-z0-9_-]{1,255}$/.test(id)
  const user = getUser()
  if (user === null) {
    const next = valid ? `/accounts/principals/${id}` : "/accounts/principals"
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const forbidden = { kind: "forbidden" } as const
  const [profile, principal, credentials] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid ? readPrincipal<{ principal: Principal }>(c, `/system/principals/${id}`) : forbidden,
    valid
      ? readMachineCredentials<MachineCredentialList>(
          c,
          `/system/principals/${id}/machine-credentials`,
        )
      : forbidden,
  ])
  return {
    email: user.email,
    pathname: "/accounts",
    id,
    initial: { profile, principal, credentials },
  }
})

export const head = defineHead(() => ({
  title: "Principalの詳細",
  bodyAttrs: { "data-shell": "app" },
}))
