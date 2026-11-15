import { FileCogIcon } from "lucide-react"
import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { TemplateList } from "@/components/app/application-types"
import { BackLink, EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Props } from "./index.server"

type TemplatesProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 申請テンプレートの一覧。選ぶと入力項目と承認ワークフローを見られる。 */
export default function ApplicationTemplates({ email, pathname, initial }: TemplatesProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const templates = useApiJson<TemplateList>(
    "/company/application-templates?limit=100",
    initial?.templates,
  )

  return (
    <>
      <BackLink href="/applications">申請</BackLink>
      <PageHeader
        title="申請のテンプレート"
        description="申請の種類ごとの、入力項目と承認の進み方です。"
      />

      <Loaded state={templates} fallback={<RowsSkeleton />}>
        {(list) =>
          list.data.length === 0 ? (
            <EmptyState
              icon={FileCogIcon}
              title="テンプレートがまだありません"
              description="CLI か MCP で登録すると、ここに出ます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {list.data.map((template) => (
                <li key={template.code}>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2>
                          <Link
                            href={`/applications/templates/${encodeURIComponent(template.code)}`}
                            className="hover:underline"
                          >
                            {template.name}
                          </Link>
                        </h2>
                      </CardTitle>
                      {template.description !== null && template.description !== "" && (
                        <CardDescription>{template.description}</CardDescription>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">{template.category}</Badge>
                        <Badge variant="outline" className="font-mono">
                          {template.code}
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
