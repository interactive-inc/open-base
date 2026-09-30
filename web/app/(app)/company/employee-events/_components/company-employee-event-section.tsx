import { EmptyState } from "@/components/empty-state"
import { FetchError } from "@/components/fetch-error"
import { StatusLabel } from "@/components/status-label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getEmployeeEventList } from "@/lib/api/get-employee-event-list"
import type { EmployeeEventKind } from "@/lib/api/types/employee-event-types"
import { toEmployeeEventKindLabel } from "@/lib/employee-event/to-employee-event-kind-label"

type Props = {
  employeeCode: string
  kind: EmployeeEventKind | null
}

/** 指定した従業員の雇用事実を読み取り専用で並べる。 */
export async function CompanyEmployeeEventSection(props: Props) {
  const events = await getEmployeeEventList({
    employeeCode: props.employeeCode,
    kind: props.kind,
  })

  if (events instanceof Error) {
    return <FetchError message="雇用事実の取得に失敗しました" />
  }

  if (events.length === 0) {
    return (
      <EmptyState
        title="記録がありません"
        description={`${props.employeeCode} に該当する雇用事実はありません。`}
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label="雇用事実の一覧">
        <TableHeader>
          <TableRow>
            <TableHead>発生日</TableHead>

            <TableHead>種別</TableHead>

            <TableHead>異動元</TableHead>

            <TableHead>異動先</TableHead>

            <TableHead>備考</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="whitespace-nowrap">{event.effective_date}</TableCell>

              <TableCell>
                <StatusLabel>{toEmployeeEventKindLabel(event.kind)}</StatusLabel>
              </TableCell>

              <TableCell>{event.from_department_code ?? "-"}</TableCell>

              <TableCell>{event.to_department_code ?? "-"}</TableCell>

              <TableCell>{event.note ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
