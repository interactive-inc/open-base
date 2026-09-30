import { FetchError } from "@/components/fetch-error"
import Link from "next/link"
import { getOrgDepartmentMembers } from "@/lib/api/get-org-department-members"
import { StatusLabel } from "@/components/status-label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  code: string
}

/** /org/departments/:code/members を認証付きで取得し、メンバー一覧をテーブル描画する非同期 RSC。 */
export async function OrgMembersTable(props: Props) {
  const members = await getOrgDepartmentMembers(props.code)

  if (members instanceof Error) {
    return <FetchError message="メンバーの取得に失敗しました" />
  }

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">メンバーがいません</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>社員コード</TableHead>
            <TableHead>氏名</TableHead>
            <TableHead>役職</TableHead>
            <TableHead>区分</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {members.map((member) => (
            <TableRow key={member.employee_code}>
              <TableCell>
                <Link
                  href={`/company/employees/${member.employee_code}/reporting-line`}
                  className="font-medium hover:underline"
                >
                  {member.employee_code}
                </Link>
              </TableCell>

              <TableCell>{member.employee_name}</TableCell>

              <TableCell>{member.position ?? "-"}</TableCell>

              <TableCell>
                {member.is_manager ? (
                  <StatusLabel>マネージャー</StatusLabel>
                ) : (
                  <StatusLabel>メンバー</StatusLabel>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
