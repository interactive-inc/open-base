import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { IdentityStateLabel, PROVIDER_TEXT } from "@/components/app/accounts-labels"
import type { IdentityList } from "@/components/app/accounts-types"
import { formatDate, Loaded } from "@/components/app/data-view"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"

/** Accountのサインインの方法（Identity）。失効したものは出さない。 */
export function AccountIdentities(props: {
  accountId: string
  initial?: ApiJsonState<IdentityList>
}) {
  const identities = useApiJson<IdentityList>(
    `/system/accounts/${props.accountId}/identities`,
    props.initial,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>サインインの方法</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Loaded state={identities} fallback={<Skeleton className="h-16 w-full rounded-2xl" />}>
          {(list) => {
            const current = list.identities.filter((identity) => identity.state !== "revoked")
            return current.length === 0 ? (
              <p>サインインの方法がありません。CLI か MCP で追加すると、ここに出ます。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {current.map((identity) => (
                  <li key={identity.id}>
                    <Item variant="muted" size="sm">
                      <ItemContent>
                        <ItemTitle>{PROVIDER_TEXT[identity.provider]}</ItemTitle>
                        <ItemDescription className="break-all">
                          {[
                            identity.email ?? identity.subject,
                            identity.last_used_at === null
                              ? "まだ使われていません"
                              : `最後に使った日 ${formatDate(identity.last_used_at)}`,
                          ].join(" · ")}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <IdentityStateLabel state={identity.state} />
                      </ItemActions>
                    </Item>
                  </li>
                ))}
              </ul>
            )
          }}
        </Loaded>
      </CardContent>
    </Card>
  )
}
