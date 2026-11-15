import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readPermissionDefinitions, readRole } from "@/api/http/accounts-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { PermissionDefinitionList, Role } from "@/components/app/accounts-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  // ロールのIDとして読めない値はAPIへ渡さず、見つからない扱いにする。
  const valid = UUID.test(id)
  const user = getUser()
  if (user === null) {
    const next = valid ? `/accounts/roles/${id}` : "/accounts/roles"
    return c.redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }
  const [profile, role, permissions] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid ? readRole<Role>(c, `/system/roles/${id}`) : ({ kind: "forbidden" } as const),
    readPermissionDefinitions<PermissionDefinitionList>(c),
  ])
  return { email: user.email, pathname: "/accounts", id, initial: { profile, role, permissions } }
})

export const head = defineHead(() => ({
  title: "ロールの詳細",
  bodyAttrs: { "data-shell": "app" },
}))
