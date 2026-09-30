import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 監査イベント一覧の公開投影。 */
export const zAppAuditEventSummary = z.strictObject({
  event_id: z.string(),
  request_id: z.string(),
  actor_account_id: z.string().min(1).max(255).nullable(),
  actor_employee_id: zEmployeeId.nullable(),
  action: z.string(),
  target_type: z.string().nullable(),
  target_id: z.string().nullable(),
  outcome: z.enum(["succeeded", "denied", "failed"]),
  reason_code: z.string().nullable(),
  client_name: z.enum(["web", "cli", "api", "system"]),
  created_at: z.string(),
})

export type AppAuditEventSummary = z.infer<typeof zAppAuditEventSummary>

/** GET /audit-events の cursor page。 */
export const zAppAuditEventPage = z.strictObject({
  data: z.array(zAppAuditEventSummary),
  next_cursor: z.string().nullable(),
  previous_cursor: z.string().nullable(),
})

export type AppAuditEventPage = z.infer<typeof zAppAuditEventPage>

/** 監査イベント一件の保存文字列を維持する公開詳細投影。 */
export const zAppAuditEventDetail = zAppAuditEventSummary.extend({
  authorization_json: z.string().nullable(),
  before_json: z.string().nullable(),
  after_json: z.string().nullable(),
  metadata_json: z.string().nullable(),
  client_ip: z.string().nullable(),
})

export type AppAuditEventDetail = z.infer<typeof zAppAuditEventDetail>
