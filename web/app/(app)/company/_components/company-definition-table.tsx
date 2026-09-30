import type { ReactNode } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Props = {
  canManage: boolean
  definitions: ReadonlyArray<{
    id: string
    code: string
    name: string
    rank: number | null
    description: string | null
    effectiveFrom: string
    effectiveTo: string | null
    actions: ReactNode
  }>
}

/** 会社の定義に共通する属性と有効期間を表示する。 */
export function CompanyDefinitionTable(props: Props) {
  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>コード</TableHead>
            <TableHead>名称</TableHead>
            <TableHead className="text-right">ランク</TableHead>
            <TableHead>説明</TableHead>
            <TableHead>有効期間</TableHead>
            {props.canManage ? <TableHead className="text-right">操作</TableHead> : null}
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.definitions.map((definition) => (
            <TableRow key={definition.id}>
              <TableCell>{definition.code}</TableCell>

              <TableCell>{definition.name}</TableCell>

              <TableCell className="text-right">{definition.rank ?? "不明"}</TableCell>

              <TableCell>{definition.description ?? "-"}</TableCell>
              <TableCell>
                {definition.effectiveFrom} 〜 {definition.effectiveTo ?? "終了日なし"}
              </TableCell>

              {props.canManage ? (
                <TableCell className="text-right">{definition.actions}</TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
