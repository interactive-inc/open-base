import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readAccountDirectory, readAccounts, readRoles } from "@/api/http/accounts-page-readers"
import { readCurrentProfile } from "@/api/http/page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { AccountDirectory, RoleList, SystemAccountList } from "@/components/app/accounts-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Faccounts")
  const [profile, accounts, directory, roles] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readAccounts<SystemAccountList>(c),
    readAccountDirectory<AccountDirectory>(c, "/company/account-directory?limit=100"),
    readRoles<RoleList>(c),
  ])
  return {
    email: user.email,
    pathname: "/accounts",
    initial: { profile, accounts, directory, roles },
  }
})

export const head = defineHead(() => ({
  title: "アカウント",
  bodyAttrs: { "data-shell": "app" },
}))
