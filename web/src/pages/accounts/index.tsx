import { UserCog } from "lucide-react"
import { Link } from "@void/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountStatusLabel } from "@/components/app/accounts-labels"
import type { AccountDirectory, RoleList, SystemAccountList } from "@/components/app/accounts-types"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  EmptyState,
  formatDate,
  Loaded,
  PageHeader,
  RowsSkeleton,
} from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type AccountsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** サインインに使うアカウントの一覧。状態、結び付いた従業員、ロールを並べる。 */
export default function Accounts({ email, pathname, initial }: AccountsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const accounts = useApiJson<SystemAccountList>("/system/accounts", initial?.accounts)
  const directory = useApiJson<AccountDirectory>(
    "/company/account-directory?limit=100",
    initial?.directory,
  )
  const roles = useApiJson<RoleList>("/system/roles", initial?.roles)

  // 名前とロールの名前は補助の情報。読めなくても一覧は出す。
  const people = new Map(
    directory.kind === "ok" ? directory.data.data.map((entry) => [entry.account_id, entry]) : [],
  )
  const roleNames = new Map(
    roles.kind === "ok" ? roles.data.roles.map((role) => [role.key, role.name]) : [],
  )

  return (
    <>
      <PageHeader
        title="アカウント"
        description="サインインに使うアカウントと、その状態とロールです。"
      />

      <Loaded state={accounts} fallback={<RowsSkeleton />}>
        {(list) =>
          list.accounts.length === 0 ? (
            <EmptyState
              icon={UserCog}
              title="まだアカウントがありません"
              description="CLI か MCP で登録すると、ここに出ます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {list.accounts.map((account) => {
                const person = people.get(account.id)
                return (
                  <li key={account.id}>
                    <Card>
                      <CardHeader>
                        <CardTitle>
                          <h2>
                            <Link
                              href={`/accounts/${account.id}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {person?.name ?? "従業員と未連携"}
                            </Link>
                          </h2>
                        </CardTitle>
                        <CardDescription className="break-all">
                          {[person?.email, `作成 ${formatDate(account.created_at)}`]
                            .filter(Boolean)
                            .join(" · ")}
                        </CardDescription>
                        <div className="flex flex-wrap gap-2">
                          <AccountStatusLabel status={account.status} />
                          {account.role_keys.map((key) => (
                            <Badge key={key} variant="secondary">
                              {roleNames.get(key) ?? key}
                            </Badge>
                          ))}
                        </div>
                      </CardHeader>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )
        }
      </Loaded>
    </>
  )
}
