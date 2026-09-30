import { z } from "zod"

const schema = z
  .object({
    proposal_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
    task_key: z.string().min(1).max(100),
    task_round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict()

/** showで確認した判断対象を、最新版の取得で置き換えずに検証する。 */
export function parseDecisionTarget(raw: unknown): z.output<typeof schema> | Error {
  if (typeof raw !== "string")
    return new Error("--decision-target に show の decision_target JSON が必要です")
  try {
    const value: unknown = JSON.parse(raw)
    const parsed = schema.safeParse(value)
    return parsed.success ? parsed.data : new Error("--decision-target が不正です")
  } catch {
    return new Error("--decision-target には有効なJSONを指定してください")
  }
}
