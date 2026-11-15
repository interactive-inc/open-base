import { Link } from "@void/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PRINCIPAL_KIND_TEXT } from "@/components/app/accounts-labels"
import { MachineCredentials } from "@/components/app/accounts-machine-credentials"
import type { Principal } from "@/components/app/accounts-types"
import type { CurrentProfile } from "@/components/app/app-shell"
import { BackLink, formatDate, Loaded, PageHeader } from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./[id].server"

type PrincipalDetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 一つのPrincipal。使うアカウントと、機械の主体なら資格情報を見る。 */
export default function PrincipalDetail({ email, pathname, id, initial }: PrincipalDetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const principal = useApiJson<{ principal: Principal }>(
    `/system/principals/${id}`,
    initial?.principal,
  )

  return (
    <>
      <BackLink href="/accounts/principals">Principalの一覧</BackLink>
      <Loaded state={principal} fallback={<Skeleton className="h-64 w-full" />}>
        {({ principal: data }) => (
          <>
            <PageHeader
              title={data.name}
              description={`作成 ${formatDate(data.created_at)} · ID ${data.id}`}
              badges={<Badge variant="secondary">{PRINCIPAL_KIND_TEXT[data.kind]}</Badge>}
            />
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>アカウント</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  このPrincipalは専用のアカウントで操作します。ロールはアカウントの画面で見られます。
                </p>
              </CardContent>
              <CardFooter className="justify-end">
                <Button variant="secondary" render={<Link href={`/accounts/${data.account_id}`} />}>
                  アカウントを開く
                </Button>
              </CardFooter>
            </Card>
            {data.kind !== "human" && (
              <MachineCredentials principalId={data.id} initial={initial?.credentials} />
            )}
          </>
        )}
      </Loaded>
    </>
  )
}
