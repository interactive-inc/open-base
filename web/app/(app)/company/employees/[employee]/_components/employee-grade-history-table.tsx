import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  label: string
  columns: ReadonlyArray<string>
  rows: ReadonlyArray<{ key: string; cells: ReadonlyArray<string> }>
}

/** 等級履歴の列と行を、確定記録と原記録それぞれの見出しで表示する。 */
export function EmployeeGradeHistoryTable(props: Props) {
  return (
    <div className="overflow-x-auto">
      <Table aria-label={props.label}>
        <TableHeader>
          <TableRow>
            {props.columns.map((column) => (
              <TableHead key={column}>{column}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.key}>
              {row.cells.map((cell, index) => (
                <TableCell key={props.columns[index]}>{cell}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
