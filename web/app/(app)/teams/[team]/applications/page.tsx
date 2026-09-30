import { DepartmentName } from "@/app/(app)/teams/[team]/_components/department-name"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { EmptyState } from "@/components/empty-state"
import { PageHeader } from "@/components/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getDepartmentApplications } from "@/lib/api/get-department-applications"

export const metadata = { title: "部署の申請" }

type Props = {
  params: Promise<{ team: string }>
}

/**
 * 部署ハブの申請タブ。所属メンバー全員の申請を一覧する。
 * 閲覧には application:read:all、または本人が所属する部署への application:read:department が必要。
 */
export default async function DepartmentApplicationsPage(props: Props) {
  const params = await props.params

  const applications = await getDepartmentApplications(params.team)

  if (applications instanceof Error) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title="部署の申請" />

        <DepartmentName team={params.team} />

        <EmptyState title="この部署の申請を閲覧する権限がありません" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="部署の申請" />

      <DepartmentName team={params.team} />

      {applications.length === 0 ? (
        <EmptyState title="この部署の申請はまだありません" />
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>申請者</TableHead>

                <TableHead>テンプレート</TableHead>

                <TableHead>状態</TableHead>

                <TableHead>申請日</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell className="whitespace-nowrap">{application.applicant_name}</TableCell>

                  <TableCell className="whitespace-nowrap">{application.template_name}</TableCell>

                  <TableCell className="whitespace-nowrap">
                    <ApplicationStatusBadge status={application.status} />
                  </TableCell>

                  <TableCell className="whitespace-nowrap">
                    {application.created_at.slice(0, 10)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
