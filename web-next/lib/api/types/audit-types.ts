export type AuditOutcome = "succeeded" | "denied" | "failed"

export type AuditClientName = "web" | "cli" | "api" | "system"

export type AuditEventSummary = {
  event_id: string
  request_id: string
  actor_account_id: string | null
  actor_employee_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  outcome: AuditOutcome
  reason_code: string | null
  client_name: AuditClientName
  created_at: string
}

export type AuditEventPage = {
  data: ReadonlyArray<AuditEventSummary>
  next_cursor: string | null
  previous_cursor: string | null
}

export type AuditEventDetail = AuditEventSummary & {
  authorization_json: string | null
  before_json: string | null
  after_json: string | null
  metadata_json: string | null
  client_ip: string | null
}

export type AuditListQuery = {
  actor_account_id?: string
  action?: string
  target_type?: string
  target_id?: string
  outcome?: AuditOutcome
  from?: string
  to?: string
  limit: string
  cursor?: string
}

export type AuditExportRequest = {
  actor_account_id?: string
  action?: string
  target_type?: string
  target_id?: string
  outcome?: AuditOutcome
  from: string
  to: string
}
