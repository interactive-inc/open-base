import type { BatchJobStatus } from "@/lib/api/types/batch-types"

/**
 * バッチジョブの状態に対応する StatusLabel の variant を返す純粋関数。
 * failed=destructive、それ以外は secondary。
 */
export function toBatchStatusVariant(status: BatchJobStatus): "secondary" | "destructive" {
  if (status === "failed") {
    return "destructive"
  }

  return "secondary"
}
