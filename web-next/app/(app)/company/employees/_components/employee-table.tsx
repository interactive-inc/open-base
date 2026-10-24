import Link from "next/link"
import { EmployeeStatusBadge } from "@/app/(app)/company/employees/_components/employee-status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { EmployeeListItem } from "@/lib/api/types/employee-list-item"

type Props = {
  employees: ReadonlyArray<EmployeeListItem>
}

/** 従業員一覧テーブル。code がある行だけ詳細へ遷移できる。 */
export function EmployeeTable(props: Props) {
  if (props.employees.length === 0) {
    return <p className="text-sm text-muted-foreground">条件に一致する従業員はいません。</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="従業員の一覧">
        <TableHeader>
          <TableRow>
            <TableHead>従業員コード</TableHead>
            <TableHead>氏名</TableHead>
            <TableHead>部署</TableHead>
            <TableHead>役職</TableHead>
            <TableHead>メールアドレス</TableHead>
            <TableHead>在籍状況</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.employees.map((employee, index) => (
            <TableRow
              key={employee.code === null ? `unlinked-${index}` : `code-${employee.code}`}
              className={employee.code === null ? undefined : "relative cursor-pointer"}
            >
              <TableCell>
                {employee.code === null ? (
                  <span className="text-muted-foreground">未設定</span>
                ) : (
                  <Link
                    href={`/company/employees/${employee.code}`}
                    className="after:absolute after:inset-0"
                  >
                    {employee.code}
                  </Link>
                )}
              </TableCell>

              <TableCell>{employee.name}</TableCell>

              <TableCell>{employee.deptName ?? "-"}</TableCell>

              <TableCell>{employee.position ?? "-"}</TableCell>

              <TableCell>{employee.email}</TableCell>

              <TableCell>
                <EmployeeStatusBadge status={employee.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
