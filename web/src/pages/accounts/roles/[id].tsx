import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import type { PermissionDefinitionList, Role } from "@/components/app/accounts-types"
import type { CurrentProfile } from "@/components/app/app-shell"
import { BackLink, formatDate, Loaded, PageHeader } from "@/components/app/data-view"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import type { Props } from "./[id].server"

type RoleDetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 一つのロール。説明と、含む権限を見る。ロールの変更はCLIかMCPで行う。 */
export default function RoleDetail({ email, pathname, id, initial }: RoleDetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const role = useApiJson<Role>(`/system/roles/${id}`, initial?.role)
  const permissions = useApiJson<PermissionDefinitionList>(
    "/system/permission-definitions",
    initial?.permissions,
  )

  return (
    <>
      <BackLink href="/accounts/roles">ロールの一覧</BackLink>
      <Loaded state={role} fallback={<Skeleton className="h-64 w-full" />}>
        {(data) => (
          <>
            <PageHeader
              title={data.name}
              description={[
                data.key,
                data.resource_type === null ? "全体" : `対象 ${data.resource_type}`,
                `更新 ${formatDate(data.updated_at)}`,
              ].join(" · ")}
              badges={
                <Badge variant="secondary">{data.kind === "managed" ? "標準" : "独自"}</Badge>
              }
            />
            <RolePermissions role={data} permissions={permissions} />
          </>
        )}
      </Loaded>
    </>
  )
}

function RolePermissions(props: {
  role: Role
  permissions: ApiJsonState<PermissionDefinitionList>
}) {
  const descriptions = new Map(
    props.permissions.kind === "ok"
      ? props.permissions.data.data.map((item) => [item.key, item.description])
      : [],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>権限</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {props.role.description !== null && <p>{props.role.description}</p>}
        {props.role.permission_keys.length === 0 ? (
          <p>権限はありません。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {props.role.permission_keys.map((key) => (
              <li key={key}>
                <Item variant="muted" size="sm">
                  <ItemContent>
                    <ItemTitle>{descriptions.get(key) ?? key}</ItemTitle>
                    <ItemDescription className="font-mono break-all">{key}</ItemDescription>
                  </ItemContent>
                </Item>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
