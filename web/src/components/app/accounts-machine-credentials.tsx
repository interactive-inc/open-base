import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import type { MachineCredentialList } from "@/components/app/accounts-types"
import { formatDate, Loaded } from "@/components/app/data-view"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"

/** 機械のPrincipalの資格情報。秘密の値は持たず、名前と期限と使った日だけを見せる。 */
export function MachineCredentials(props: {
  principalId: string
  initial?: ApiJsonState<MachineCredentialList>
}) {
  const credentials = useApiJson<MachineCredentialList>(
    `/system/principals/${props.principalId}/machine-credentials`,
    props.initial,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>資格情報</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Loaded state={credentials} fallback={<Skeleton className="h-16 w-full rounded-2xl" />}>
          {(list) =>
            list.credentials.length === 0 ? (
              <p>資格情報がありません。CLI か MCP で発行すると、ここに出ます。</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {list.credentials.map((credential) => (
                  <li key={credential.id}>
                    <Item variant="muted" size="sm">
                      <ItemContent>
                        <ItemTitle>{credential.name}</ItemTitle>
                        <ItemDescription className="break-all">
                          {[
                            `ID ${credential.id}`,
                            credential.expires_at === null
                              ? "期限なし"
                              : `期限 ${formatDate(credential.expires_at)}`,
                            credential.last_used_at === null
                              ? "まだ使われていません"
                              : `最後に使った日 ${formatDate(credential.last_used_at)}`,
                          ].join(" · ")}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Badge variant="outline">
                          {credential.status === "active" ? "使用可" : "失効"}
                        </Badge>
                      </ItemActions>
                    </Item>
                  </li>
                ))}
              </ul>
            )
          }
        </Loaded>
      </CardContent>
    </Card>
  )
}
