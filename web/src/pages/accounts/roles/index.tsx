import { ShieldCheck } from "lucide-react"
import { Link } from "@void/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { RoleList } from "@/components/app/accounts-types"
import type { CurrentProfile } from "@/components/app/app-shell"
import { EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type RolesProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** ロールの一覧。ロールは権限の束で、アカウントに付けて使う。 */
export default function Roles({ email, pathname, initial }: RolesProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const roles = useApiJson<RoleList>("/system/roles", initial?.roles)

  return (
    <>
      <PageHeader
        title="ロール"
        description="ロールは権限の束です。アカウントに付けると、その権限で操作できるようになります。"
      />

      <Loaded state={roles} fallback={<RowsSkeleton />}>
        {(list) =>
          list.roles.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="まだロールがありません"
              description="CLI か MCP で登録すると、ここに出ます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {list.roles.map((role) => (
                <li key={role.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2>
                          <Link
                            href={`/accounts/roles/${role.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {role.name}
                          </Link>
                        </h2>
                      </CardTitle>
                      <CardDescription className="break-all">
                        {[
                          role.key,
                          role.resource_type === null ? "全体" : `対象 ${role.resource_type}`,
                          `権限 ${role.permission_keys.length}件`,
                        ].join(" · ")}
                      </CardDescription>
                      <div>
                        <Badge variant="secondary">
                          {role.kind === "managed" ? "標準" : "独自"}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </Loaded>
    </>
  )
}
