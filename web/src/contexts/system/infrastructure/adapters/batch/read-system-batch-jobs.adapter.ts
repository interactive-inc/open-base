import type { SystemBatchJobStatus } from "@system/domain/schemas/batch/system-batch-job-status.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

export type SystemBatchJobView = Readonly<{
  id: string
  name: string
  status: SystemBatchJobStatus
  startedAt: Date | null
  finishedAt: Date | null
  message: string | null
}>
type Context = SystemD1Context

/** System batch jobを固定ページ境界で読む。 */
export class ReadSystemBatchJobsAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  async readSystemBatchJobs(
    input: Readonly<{ limit: number; offset: number }>,
  ): Promise<Readonly<{ jobs: ReadonlyArray<SystemBatchJobView>; total: number }> | Error> {
    if (
      !Number.isSafeInteger(input.limit) ||
      input.limit < 1 ||
      !Number.isSafeInteger(input.offset) ||
      input.offset < 0
    ) {
      return new Error("invalid System batch job page")
    }
    try {
      const [rows, total] = await Promise.all([
        this.c.env.DB.prepare(
          `SELECT id, name, status, started_at, finished_at, message
         FROM system_batch_jobs
         ORDER BY rowid DESC
         LIMIT ?1 OFFSET ?2`,
        )
          .bind(input.limit, input.offset)
          .all<{
            id: string
            name: string
            status: SystemBatchJobStatus
            started_at: number | null
            finished_at: number | null
            message: string | null
          }>(),
        this.c.env.DB.prepare("SELECT count(*) AS total FROM system_batch_jobs").first<number>(
          "total",
        ),
      ])
      return {
        jobs: rows.results.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          startedAt: row.started_at === null ? null : new Date(row.started_at),
          finishedAt: row.finished_at === null ? null : new Date(row.finished_at),
          message: row.message,
        })),
        total: total ?? 0,
      }
    } catch (caught) {
      return caught instanceof Error ? caught : new Error("failed to read System batch jobs")
    }
  }
}
