import type { EntityId } from "@/lib/api/types/entity-id"

/** バッチジョブの実行状態。api/src/batch/batch-response-schema.ts の status enum と一致させる。 */
export type BatchJobStatus = "running" | "completed" | "failed"

/**
 * GET /batch の各要素（バッチジョブ）。
 * レスポンスは snake_case なので型もそれに合わせる。値なしは null。
 */
export type BatchJobResponse = {
  id: EntityId
  name: string
  status: BatchJobStatus
  started_at: string | null
  finished_at: string | null
  message: string | null
}
