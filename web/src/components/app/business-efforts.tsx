import { ClockIcon } from "lucide-react"
import { VoidLabel } from "@/components/app/business-status"
import { formatMinutes, type EffortRecord, type RecordPage } from "@/components/app/business-types"
import { formatDate, Loaded } from "@/components/app/data-view"
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

/**
 * 案件の工数の欄。記録した人ごとの作業時間を新しい日から表に並べる。
 * 取り消した工数は履歴として残し、取消済みと分かるように見せる。実績の合計からは外れている。
 */
export function ProjectEfforts(props: { projectId: string; employeeName: (id: string) => string }) {
  const efforts = useApiJson<RecordPage<EffortRecord>>(
    `/client-project/records?kind=effort&project_id=${props.projectId}&limit=100`,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>工数</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Loaded state={efforts} fallback={<Skeleton className="h-24 w-full" />}>
          {(page) =>
            page.data.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ClockIcon />
                  </EmptyMedia>
                  <EmptyTitle>まだ工数がありません</EmptyTitle>
                  <EmptyDescription>CLI か MCP で工数を記録すると、ここに出ます。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>作業日</TableHead>
                    <TableHead className="text-right">時間</TableHead>
                    <TableHead>記録した人</TableHead>
                    <TableHead>理由</TableHead>
                    <TableHead>状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...page.data]
                    .sort((a, b) => b.worked_on.localeCompare(a.worked_on))
                    .map((effort) => (
                      <EffortRow
                        key={`${effort.id}-${effort.revision}`}
                        effort={effort}
                        employeeName={props.employeeName}
                      />
                    ))}
                </TableBody>
              </Table>
            )
          }
        </Loaded>
      </CardContent>
    </Card>
  )
}

function EffortRow(props: { effort: EffortRecord; employeeName: (id: string) => string }) {
  const { effort } = props
  const voided = effort.status === "void"

  return (
    <TableRow>
      <TableCell className="tabular-nums">{formatDate(effort.worked_on)}</TableCell>
      <TableCell
        className={`text-right tabular-nums ${voided ? "text-muted-foreground line-through" : ""}`}
      >
        {formatMinutes(effort.minutes)}
      </TableCell>
      <TableCell>{props.employeeName(effort.employee_id)}</TableCell>
      <TableCell className="min-w-48 whitespace-normal">{effort.reason}</TableCell>
      <TableCell>{voided && <VoidLabel />}</TableCell>
    </TableRow>
  )
}
