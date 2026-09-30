import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type SystemResourceColumn<T> = {
  header: string
  toValue: (resource: T) => React.ReactNode
}

type Props<T> = {
  caption: string
  columns: ReadonlyArray<SystemResourceColumn<T>>
  resources: ReadonlyArray<T>
  toKey: (resource: T) => string
  emptyTitle: string
  emptyDescription: string
}

/**
 * System の運用情報を読み取り専用で並べるテーブル。
 * Company の resource と違い System の応答は route ごとに形が違うので、
 * 共通の封筒を仮定せず、列の取り出しと行の key を呼び出し側から受け取る。
 */
export function SystemResourceTable<T>(props: Props<T>) {
  if (props.resources.length === 0) {
    return <EmptyState title={props.emptyTitle} description={props.emptyDescription} />
  }

  return (
    <div className="overflow-x-auto">
      <Table aria-label={props.caption}>
        <TableHeader>
          <TableRow>
            {props.columns.map((column) => (
              <TableHead key={column.header}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.resources.map((resource) => (
            <TableRow key={props.toKey(resource)}>
              {props.columns.map((column) => (
                <TableCell key={column.header}>{column.toValue(resource)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
