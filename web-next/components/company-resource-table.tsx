import { EmptyState } from "@/components/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CompanyResource } from "@/lib/api/types/company-resource-types"
import { toResourcePeriodLabel } from "@/lib/company/to-resource-period-label"

export type ResourceColumn = {
  header: string
  toValue: (resource: CompanyResource) => React.ReactNode
}

type Props = {
  caption: string
  columns: ReadonlyArray<ResourceColumn>
  resources: ReadonlyArray<CompanyResource>
  emptyTitle: string
  emptyDescription: string
}

/**
 * Company の汎用 resource を読み取り専用で並べるテーブル。
 * 列の見出しと値の取り出しだけを呼び出し側から受け取り、
 * 識別子・有効期間・状態は全 resource 共通なので末尾に固定で出す。
 */
export function CompanyResourceTable(props: Props) {
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

            <TableHead>有効期間</TableHead>

            <TableHead>状態</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.resources.map((resource) => (
            <TableRow key={`${resource.type}:${resource.id}`}>
              {props.columns.map((column) => (
                <TableCell key={column.header}>{column.toValue(resource)}</TableCell>
              ))}

              <TableCell className="whitespace-nowrap">{toResourcePeriodLabel(resource)}</TableCell>

              <TableCell>{resource.state === "active" ? "有効" : "無効"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
