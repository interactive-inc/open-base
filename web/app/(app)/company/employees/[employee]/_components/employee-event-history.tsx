import { toEmployeeEventKindLabel } from "@/lib/employee-event/to-employee-event-kind-label"
import { getEmployeeEventList } from "@/lib/api/get-employee-event-list"
import { FetchError } from "@/components/fetch-error"
import { StatusLabel } from "@/components/status-label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

/** 元の人事注記を、確定した発令と区別して表示する。 */
export async function EmployeeEventHistory(props: Props) {
  const events = await getEmployeeEventList({ employeeCode: props.code, kind: null })

  if (events instanceof Error) {
    return <FetchError message="旧異動・在籍記録を取得できませんでした" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>旧異動・在籍記録</CardTitle>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">異動・在籍イベントの記録はありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <Table aria-label="異動・在籍履歴">
              <TableHeader>
                <TableRow>
                  <TableHead>適用日</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>異動元</TableHead>
                  <TableHead>異動先</TableHead>
                  <TableHead>備考</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>{event.effective_date}</TableCell>

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
        )}
      </CardContent>
    </Card>
  )
}
