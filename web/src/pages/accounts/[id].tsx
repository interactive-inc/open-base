import { Skeleton } from "@/components/ui/skeleton"
import { AccountEmployeeLinkPanel } from "@/components/app/accounts-employee-link"
import { AccountIdentities } from "@/components/app/accounts-identities"
import { AccountRoleBindings } from "@/components/app/accounts-role-bindings"
import { AccountStatusPanel } from "@/components/app/accounts-status-panel"
import type { AccountDirectory, RoleList, SystemAccount } from "@/components/app/accounts-types"
import type { CurrentProfile } from "@/components/app/app-shell"
import { BackLink, formatDate, Loaded, PageHeader } from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial" | "organizationId"> & {
  initial?: Props["initial"]
  organizationId?: string
}

/** 一つのアカウント。状態、サインインの方法、ロール、従業員との結び付けを見る。 */
export default function AccountDetail({
  email,
  pathname,
  id,
  organizationId,
  initial,
}: DetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const account = useApiJson<SystemAccount>(`/system/accounts/${id}`, initial?.account)
  const roles = useApiJson<RoleList>("/system/roles", initial?.roles)
  const directory = useApiJson<AccountDirectory>(
    "/company/account-directory?limit=100",
    initial?.directory,
  )
  const person =
    directory.kind === "ok"
      ? directory.data.data.find((entry) => entry.account_id === id)
      : undefined

  return (
    <>
      <BackLink href="/accounts">アカウントの一覧</BackLink>

      <Loaded state={account} fallback={<Skeleton className="h-64 w-full" />}>
        {(data) => (
          <>
            <PageHeader
              title={person?.name ?? "従業員と未連携のアカウント"}
              description={[person?.email, `作成 ${formatDate(data.created_at)}`, `ID ${data.id}`]
                .filter(Boolean)
                .join(" · ")}
            />
            <AccountStatusPanel account={data} />
            <AccountIdentities accountId={data.id} initial={initial?.identities} />
            <AccountRoleBindings
              accountId={data.id}
              initial={initial?.roleBindings}
              roles={roles}
            />
            <AccountEmployeeLinkPanel
              accountId={data.id}
              organizationId={organizationId ?? null}
              person={person}
            />
          </>
        )}
      </Loaded>
    </>
  )
}
