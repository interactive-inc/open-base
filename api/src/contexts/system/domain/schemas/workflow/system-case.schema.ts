import { z } from "zod"

export const systemCaseIdSchema = z.uuid().brand<"SystemCaseId">()
export type SystemCaseId = z.infer<typeof systemCaseIdSchema>

/** 新しいSystem案件を識別するopaque IDを生成する。 */
export function createSystemCaseId(): SystemCaseId {
  return systemCaseIdSchema.parse(crypto.randomUUID())
}

export const systemCaseStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "returned",
  "cancelled",
  "executed",
])
export type SystemCaseStatus = z.infer<typeof systemCaseStatusSchema>
