import type { BatchJobStatus } from "@/lib/api/types/batch-types"

/**
 * バッチジョブの状態を日本語表示ラベルへ変換する純粋関数。
 * 想定外の値はそのまま文字列として返す。
 */
export function toBatchStatusLabel(status: BatchJobStatus): string {
  if (status === "running") {
    return "実行中"
  }

  if (status === "completed") {
    return "完了"
  }

  if (status === "failed") {
    return "失敗"
  }

  return status
}
