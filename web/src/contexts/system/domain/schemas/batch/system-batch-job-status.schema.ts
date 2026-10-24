import { z } from "zod"

/** runtimeに依存しないSystem batch jobの実行状態。 */
export const systemBatchJobStatusSchema = z.enum(["running", "completed", "failed"])

export type SystemBatchJobStatus = z.infer<typeof systemBatchJobStatusSchema>
