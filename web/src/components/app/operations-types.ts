/**
 * 運用と監査の画面が読むAPIの応答の形。
 * 正本は各routeのzod schemaと応答の組み立て。ここは画面が使う形だけを写す。
 */

/** GET /system/health */
export type Health = { status: string }

/** GET /company/features */
export type FeatureAvailability = { disabled_features: ReadonlyArray<string> }

export type DeadLetter = {
  id: string
  source_type: "job" | "outbox" | "inbox"
  source_id: string
  payload_digest: string
  reason_code: string
  attempt: number
  recorded_at: string
  requeued_job_id: string | null
  requeued_at: string | null
}

/** GET /system/dead-letters */
export type DeadLetterList = { dead_letters: ReadonlyArray<DeadLetter> }

export type DeliveryKind = "job" | "outbox"
export type DeliveryStatus = "queued" | "leased" | "succeeded" | "dead_letter"

export type Delivery = {
  id: string
  kind: DeliveryKind
  operation_key: string
  handler_key: string | null
  payload_digest: string
  idempotency_key: string
  status: DeliveryStatus
  attempt: number
  max_attempts: number
  available_at: string
  lease_account_id: string | null
  lease_expires_at: string | null
  last_error_code: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

/** GET /system/deliveries?kind= */
export type DeliveryList = { deliveries: ReadonlyArray<Delivery> }

export type BatchJob = {
  id: string
  name: string
  status: "running" | "completed" | "failed"
  started_at: string | null
  finished_at: string | null
  message: string | null
}

/** GET /system/batch-jobs */
export type BatchJobPage = { data: ReadonlyArray<BatchJob>; total: number }

export type Connector = {
  id: string
  key: string
  name: string
  direction: "inbound" | "outbound" | "bidirectional"
  transport: "api" | "file" | "webhook"
  status: "active" | "disabled"
  revision: number
  created_at: string
  updated_at: string
}

/** GET /system/connectors */
export type ConnectorList = { connectors: ReadonlyArray<Connector> }

export type ExchangeStatus = "pending" | "succeeded" | "failed" | "cancelled"

export type IntegrationExchange = {
  id: string
  connector_id: string
  direction: "inbound" | "outbound"
  operation_key: string
  idempotency_key: string
  payload_digest: string
  status: ExchangeStatus
  attempt: number
  external_reference: string | null
  last_error_code: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

/** GET /system/integration-exchanges?connector_id= */
export type ExchangeList = { exchanges: ReadonlyArray<IntegrationExchange> }

export type AuditOutcome = "succeeded" | "denied" | "failed"

/** 会社の監査記録の一行。GET /company/audit-events */
export type CompanyAuditEvent = {
  event_id: string
  request_id: string
  actor_account_id: string | null
  actor_employee_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  outcome: AuditOutcome
  reason_code: string | null
  client_name: "web" | "cli" | "api" | "system"
  created_at: string
}

export type CompanyAuditPage = {
  data: ReadonlyArray<CompanyAuditEvent>
  next_cursor: string | null
  previous_cursor: string | null
}

/** GET /company/audit-events/:eventId */
export type CompanyAuditDetail = CompanyAuditEvent & {
  authorization_json: string | null
  before_json: string | null
  after_json: string | null
  metadata_json: string | null
  client_ip: string | null
}

export type AuditDisclosureField =
  | "actor_account_id"
  | "target_id"
  | "reason_code"
  | "authorization_json"
  | "before_json"
  | "after_json"
  | "metadata_json"

/** システムの監査記録の一件。GET /system/audit-events と /system/audit-events/:eventId */
export type SystemAuditEvent = {
  event_id: string
  actor_account_id: string | null
  action: string
  target_type: string
  target_id: string | null
  outcome: AuditOutcome
  reason_code: string | null
  authorization_json: string | null
  before_json: string | null
  after_json: string | null
  metadata_json: string | null
  occurred_at: string
  redacted_fields: ReadonlyArray<AuditDisclosureField>
}

export type SystemAuditPage = {
  events: ReadonlyArray<SystemAuditEvent>
  total: number
  limit: number
  offset: number
  boundary: string | null
}

export type AuditDisclosurePolicy = {
  scope: string
  commandId: string
  enabled: boolean
  allowedFields: ReadonlyArray<AuditDisclosureField>
  allowedTargetTypes: ReadonlyArray<string> | null
  allowedPurposes: ReadonlyArray<string> | null
  expiresAt: string | null
  reason: string
  actorAccountId: string
  revision: number
  recordedAt: string
  auditEventId: string
}

/** GET /system/audit-disclosure-policies?scope= */
export type AuditDisclosureCurrent = { policy: AuditDisclosurePolicy | null }

export type WorkActor = { accountId: string; principalId: string; kind: "human" | "agent" }

export type WorkState = "offered" | "active" | "review_pending" | "completed" | "cancelled"

export type WorkAction =
  | "create"
  | "accept"
  | "submit"
  | "approve"
  | "return"
  | "request_handover"
  | "accept_handover"
  | "decline_handover"
  | "cancel"

export type WorkItem = {
  id: string
  revision: number
  commandId: string
  requestDigest: string
  action: WorkAction
  title: string
  instructions: string
  acceptanceCriteria: string
  dueAt: string | null
  previousRevisionId: string | null
  createdBy: WorkActor
  createdAt: string
  assignee: WorkActor
  accountable: WorkActor
  state: WorkState
  result: {
    id: string
    digest: string
    summary: string
    evidence: ReadonlyArray<{ attachmentId: string; sha256: string }>
    submittedAt: string
    submittedBy: WorkActor
  } | null
  handover: {
    id: string
    to: WorkActor
    requestedBy: WorkActor
    requestedAt: string
    reason: string
  } | null
  actor: WorkActor
  recovery: boolean
  reason: string
  recordedAt: string
  auditEventId: string
}

/** GET /system/work-items */
export type WorkItemPage = { workItems: ReadonlyArray<WorkItem>; nextCursor: string | null }

/** GET /system/work-items/:id */
export type WorkItemDetail = { workItem: WorkItem }

/** GET /system/work-items/:id/history */
export type WorkItemHistory = {
  revisions: ReadonlyArray<WorkItem>
  nextRevision: number | null
}
