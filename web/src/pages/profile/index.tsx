import { UsersIcon } from "lucide-react"
import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { Loaded, PageHeader } from "@/components/app/data-view"
import type { DirectReportList, MyProfile } from "@/components/app/employees-types"
import { useApiJson } from "@/components/app/use-api-json"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Props } from "./index.server"

type ProfileProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 本人の情報。所属と連絡先と、直属の部下を見せる。 */
export default function MyProfilePage({ email, pathname, initial }: ProfileProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const myProfile = useApiJson<MyProfile>("/company/my-profile", initial?.myProfile)
  const reports = useApiJson<DirectReportList>("/company/my-direct-reports", initial?.reports)

  return (
    <>
      <PageHeader title="あなたの情報" description="会社に登録されている、あなたの情報です。" />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>所属と連絡先</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loaded state={myProfile} fallback={<Skeleton className="h-24 w-full" />}>
            {(me) => (
              <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
                <dt className="text-muted-foreground">氏名</dt>
                <dd>{me.name}</dd>
                <dt className="text-muted-foreground">メールアドレス</dt>
                <dd className="break-all">{email}</dd>
                <dt className="text-muted-foreground">部署</dt>
                <dd>{profile.kind === "ok" ? (profile.data.dept_name ?? "所属なし") : "—"}</dd>
                <dt className="text-muted-foreground">役職</dt>
                <dd>{profile.kind === "ok" ? (profile.data.position ?? "なし") : "—"}</dd>
                <dt className="text-muted-foreground">電話番号</dt>
                <dd>{me.phone ?? "未登録"}</dd>
              </dl>
            )}
          </Loaded>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>あなたの部下</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loaded state={reports} fallback={<Skeleton className="h-32 w-full" />}>
            {(list) =>
              list.data.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersIcon />
                    </EmptyMedia>
                    <EmptyTitle>直属の部下はいません</EmptyTitle>
                    <EmptyDescription>
                      あなたが上長として登録された人が、ここに並びます。
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>氏名</TableHead>
                      <TableHead>従業員番号</TableHead>
                      <TableHead>部署</TableHead>
                      <TableHead>役職</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.data.map((report) => (
                      <TableRow key={report.employee_id}>
                        <TableCell className="font-medium">
                          {report.code === null ? (
                            report.name
                          ) : (
                            <Link
                              href={`/employees/${encodeURIComponent(report.code)}`}
                              className="hover:underline"
                            >
                              {report.name}
                            </Link>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">{report.code ?? "—"}</TableCell>
                        <TableCell>{report.dept_name ?? "所属なし"}</TableCell>
                        <TableCell>{report.position ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            }
          </Loaded>
        </CardContent>
      </Card>
    </>
  )
}
