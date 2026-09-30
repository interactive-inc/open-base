import { z } from "zod"
import { UsageError } from "@/lib/errors"

/** showで確認した判断対象を解析し、最新の別対象へ自動で差し替えない。 */
export function parseExpenseDecisionTarget(value: string | undefined) {
  if (value === undefined)
    throw new UsageError("--decision-target にshowで確認したJSONを指定してください")
  try {
    return z
      .object({
        proposal_version: z.number().int().positive(),
        proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
        task_key: z.string().min(1).max(100),
        task_round: z.number().int().positive(),
      })
      .strict()
      .parse(JSON.parse(value))
  } catch {
    throw new UsageError("--decision-target が不正です")
  }
}
