import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  readAccount,
  readAccountDirectory,
  readAccountIdentities,
  readAccountRoleBindings,
  readCompanyOrganizationId,
  readRoles,
} from "@/api/http/accounts-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type {
  AccountDirectory,
  IdentityList,
  RoleBindingList,
  RoleList,
  SystemAccount,
} from "@/components/app/accounts-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  // AccountのIDとして読めない値はAPIへ渡さず、見つからない扱いにする。
  const valid = UUID.test(id)
  const user = getUser()
  if (user === null) {
    return c.redirect(
      `/sign-in?next=${encodeURIComponent(valid ? `/accounts/${id}` : "/accounts")}`,
    )
  }
  const forbidden = { kind: "forbidden" } as const
  const [profile, account, identities, roleBindings, roles, directory] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid ? readAccount<SystemAccount>(c, `/system/accounts/${id}`) : forbidden,
    valid ? readAccountIdentities<IdentityList>(c, `/system/accounts/${id}/identities`) : forbidden,
    valid
      ? readAccountRoleBindings<RoleBindingList>(c, `/system/accounts/${id}/role-bindings`)
      : forbidden,
    readRoles<RoleList>(c),
    readAccountDirectory<AccountDirectory>(c, "/company/account-directory?limit=100"),
  ])
  return {
    email: user.email,
    pathname: "/accounts",
    id,
    organizationId: readCompanyOrganizationId(),
    initial: { profile, account, identities, roleBindings, roles, directory },
  }
})

export const head = defineHead(() => ({
  title: "アカウントの詳細",
  bodyAttrs: { "data-shell": "app" },
}))
