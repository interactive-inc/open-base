import { Bot } from "lucide-react"
import { Link } from "@void/react"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PRINCIPAL_KIND_TEXT } from "@/components/app/accounts-labels"
import type { PrincipalList } from "@/components/app/accounts-types"
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

type PrincipalsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 操作の主体（Principal）の一覧。人のほか、エージェントやサービスなど機械の主体を持つ。 */
export default function Principals({ email, pathname, initial }: PrincipalsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const principals = useApiJson<PrincipalList>("/system/principals", initial?.principals)

  return (
    <>
      <PageHeader
        title="Principal"
        description="操作する主体です。エージェントやサービスなど機械の主体には、専用のアカウントと資格情報を持たせます。"
      />

      <Loaded state={principals} fallback={<RowsSkeleton />}>
        {(list) =>
          list.principals.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="まだPrincipalがありません"
              description="CLI か MCP で登録すると、ここに出ます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {list.principals.map((principal) => (
                <li key={principal.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2>
                          <Link
                            href={`/accounts/principals/${principal.id}`}
                            className="underline-offset-4 hover:underline"
                          >
                            {principal.name}
                          </Link>
                        </h2>
                      </CardTitle>
                      <CardDescription>作成 {formatDate(principal.created_at)}</CardDescription>
                      <div>
                        <Badge variant="secondary">{PRINCIPAL_KIND_TEXT[principal.kind]}</Badge>
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
