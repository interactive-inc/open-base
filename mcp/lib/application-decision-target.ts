import { z } from "zod"

/** showで確認した申請と判断taskの版を、APIの対象照合へそのまま渡す。 */
export const applicationDecisionTarget = z
  .strictObject({
    proposal_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
    task_key: z.string().min(1).max(100),
    task_round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .describe("Copy decision_target from the application shown to the user before deciding.")
