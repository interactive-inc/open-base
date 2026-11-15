import { FileTextIcon } from "lucide-react"
import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { isReturnedStep, type MyApplicationList } from "@/components/app/application-types"
import {
  EmptyState,
  formatDate,
  Loaded,
  PageHeader,
  RowsSkeleton,
} from "@/components/app/data-view"
import { ReturnedLabel } from "@/components/app/applications-returned-label"
import { ApplicationStatusLabel } from "@/components/app/phase-bar"
import { useApiJson } from "@/components/app/use-api-json"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Props } from "./index.server"

type ApplicationsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 自分が出した申請の一覧。 */
export default function Applications({ email, pathname, initial }: ApplicationsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const applications = useApiJson<MyApplicationList>(
    "/company/application-requests/me",
    initial?.applications,
  )

  return (
    <>
      <PageHeader title="申請" description="あなたが出した申請と、その進み具合です。" />

      <Loaded state={applications} fallback={<RowsSkeleton />}>
        {(list) =>
          list.data.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title="まだ申請がありません"
              description="CLI か MCP で申請を出すと、ここで進み具合を確かめられます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {list.data.map((item, index) => (
                <li key={item.id ?? `row-${index}`}>
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        <h2>
                          {item.id === null ? (
                            item.template_name
                          ) : (
                            <Link href={`/applications/${item.id}`} className="hover:underline">
                              {item.template_name}
                            </Link>
                          )}
                        </h2>
                      </CardTitle>
                      <CardDescription>{formatDate(item.created_at)}</CardDescription>
                      <div className="flex flex-wrap gap-2">
                        {isReturnedStep(item.current_step) && <ReturnedLabel />}
                        <ApplicationStatusLabel status={item.status} />
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
