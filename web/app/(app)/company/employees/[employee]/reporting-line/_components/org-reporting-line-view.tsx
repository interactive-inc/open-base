import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { getOrgReportingLine } from "@/lib/api/get-org-reporting-line"
import { EmptyState } from "@/components/empty-state"
import { Card } from "@/components/ui/card"

type Props = {
  code: string
}

/** /org/reporting-line/:employee_code を認証付きで取得し、本人から上位への系列を縦に描画する非同期 RSC。 */
export async function OrgReportingLineView(props: Props) {
  const nodes = await getOrgReportingLine(props.code)

  if (nodes instanceof Error) {
    return <FetchError message="レポートラインの取得に失敗しました" />
  }

  if (nodes.length === 0) {
    return <EmptyState title="レポートラインがありません" />
  }

  return (
    <ol className="flex flex-col gap-2">
      {nodes.map((node) => (
        <li key={node.employee_id} style={{ paddingInlineStart: `${node.depth * 1.5}rem` }}>
          <Card className="gap-0">
            <div className="flex items-center gap-4 p-4">
              <span className="text-xs text-muted-foreground">Lv.{node.depth}</span>

              <span className="text-sm font-medium">{node.employee_name}</span>

              <span className="text-xs text-muted-foreground">{node.employee_code}</span>

              <span className="text-xs text-muted-foreground">{node.position ?? "-"}</span>

              {node.department_code !== null && (
                <Link
                  href={`/teams/${node.department_code}/members`}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {node.department_code}
                </Link>
              )}
            </div>
          </Card>
        </li>
      ))}
    </ol>
  )
}
