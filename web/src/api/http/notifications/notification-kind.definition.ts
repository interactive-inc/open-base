import { z } from "zod"

/** Company と業務が公開 API で扱う通知種別。System の通知エンベロープには依存させない。 */
export const companyNotificationKindSchema = z.enum([
  "task",
  "approval_request",
  "approval_result",
  "reminder",
  "announcement",
  "thanks",
])

export type CompanyNotificationKind = z.infer<typeof companyNotificationKindSchema>
