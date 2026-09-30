import { toBatchStatusLabel } from "@/app/(app)/system/batches/_lib/to-batch-status-label"
import { toBatchStatusVariant } from "@/app/(app)/system/batches/_lib/to-batch-status-variant"
import { StatusLabel } from "@/components/status-label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BatchJobResponse } from "@/lib/api/types/batch-types"

type Props = {
  jobs: ReadonlyArray<BatchJobResponse>
}

/**
 * バッチジョブの状況をテーブル描画する表示専用コンポーネント。
 * ジョブ名 / 状態（バッジ）/ 最終実行（finished_at、無ければ started_at）を表示する。
 */
export function BatchJobTable(props: Props) {
  return (
    <div className="overflow-x-auto">
      <Table aria-label="一覧">
        <TableHeader>
          <TableRow>
            <TableHead>ジョブ名</TableHead>
            <TableHead>状態</TableHead>
            <TableHead>最終実行</TableHead>
            <TableHead>メッセージ</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {props.jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell>{job.name}</TableCell>

              <TableCell>
                <StatusLabel variant={toBatchStatusVariant(job.status)}>
                  {toBatchStatusLabel(job.status)}
                </StatusLabel>
              </TableCell>

              <TableCell>{job.finished_at ?? job.started_at ?? "-"}</TableCell>

              <TableCell>{job.message ?? "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
