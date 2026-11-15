import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import type { RoleBindingList, RoleList } from "@/components/app/accounts-types"
import { formatDate, Loaded } from "@/components/app/data-view"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"

/** Accountに今付いているロール。外したものは出さない。 */
export function AccountRoleBindings(props: {
  accountId: string
  initial?: ApiJsonState<RoleBindingList>
  roles: ApiJsonState<RoleList>
}) {
  const bindings = useApiJson<RoleBindingList>(
    `/system/accounts/${props.accountId}/role-bindings`,
    props.initial,
  )
  const roleById = new Map(
    props.roles.kind === "ok" ? props.roles.data.roles.map((role) => [role.id, role]) : [],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>ロール</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Loaded state={bindings} fallback={<Skeleton className="h-16 w-full rounded-2xl" />}>
          {(list) => {
            const current = list.role_bindings.filter((binding) => binding.revoked_at === null)
            return current.length === 0 ? (
              <p>ロールが付いていません。CLI か MCP で付けると、ここに出ます。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {current.map((binding) => {
                  const role = roleById.get(binding.role_id)
                  return (
                    <li key={binding.id}>
                      <Item variant="muted" size="sm">
                        <ItemContent>
                          <ItemTitle>{role?.name ?? binding.role_id}</ItemTitle>
                          <ItemDescription className="break-all">
                            {[
                              role?.key,
                              binding.resource === null
                                ? "全体"
                                : `${binding.resource.type} ${binding.resource.id}`,
                              `付けた日 ${formatDate(binding.created_at)}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </ItemDescription>
                        </ItemContent>
                      </Item>
                    </li>
                  )
                })}
              </ul>
            )
          }}
        </Loaded>
      </CardContent>
    </Card>
  )
}
