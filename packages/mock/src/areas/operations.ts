import type { Scenario } from "../types.ts"
import { defineMockArea } from "./area.ts"

type Actor = { accountId: string; principalId: string; kind: "human" | "agent" }

type DeadLetter = {
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

type Delivery = {
  id: string
  kind: "job" | "outbox"
  operation_key: string
  handler_key: string | null
  payload_digest: string
  idempotency_key: string
  status: "queued" | "leased" | "succeeded" | "dead_letter"
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

type BatchJob = {
  id: string
  name: string
  status: "running" | "completed" | "failed"
  started_at: string | null
  finished_at: string | null
  message: string | null
}

type Connector = {
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

type Exchange = {
  id: string
  connector_id: string
  direction: "inbound" | "outbound"
  operation_key: string
  idempotency_key: string
  payload_digest: string
  status: "pending" | "succeeded" | "failed" | "cancelled"
  attempt: number
  external_reference: string | null
  last_error_code: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

type Outcome = "succeeded" | "denied" | "failed"

type CompanyAudit = {
  event_id: string
  request_id: string
  actor_account_id: string | null
  actor_employee_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  outcome: Outcome
  reason_code: string | null
  client_name: "web" | "cli" | "api" | "system"
  created_at: string
  authorization_json: string | null
  before_json: string | null
  after_json: string | null
  metadata_json: string | null
  client_ip: string | null
}

type SystemAudit = {
  event_id: string
  actor_account_id: string | null
  action: string
  target_type: string
  target_id: string | null
  outcome: Outcome
  reason_code: string | null
  authorization_json: string | null
  before_json: string | null
  after_json: string | null
  metadata_json: string | null
  occurred_at: string
  redacted_fields: string[]
}

type Policy = {
  scope: string
  commandId: string
  enabled: boolean
  allowedFields: string[]
  allowedTargetTypes: string[] | null
  allowedPurposes: string[] | null
  expiresAt: string | null
  reason: string
  actorAccountId: string
  revision: number
  recordedAt: string
  auditEventId: string
}

type WorkItem = {
  id: string
  revision: number
  commandId: string
  requestDigest: string
  action: string
  title: string
  instructions: string
  acceptanceCriteria: string
  dueAt: string | null
  previousRevisionId: string | null
  createdBy: Actor
  createdAt: string
  assignee: Actor
  accountable: Actor
  state: "offered" | "active" | "review_pending" | "completed" | "cancelled"
  result: {
    id: string
    digest: string
    summary: string
    evidence: { attachmentId: string; sha256: string }[]
    submittedAt: string
    submittedBy: Actor
  } | null
  handover: {
    id: string
    to: Actor
    requestedBy: Actor
    requestedAt: string
    reason: string
  } | null
  actor: Actor
  authentication: {
    tokenVersion: number
    credentialId: string | null
    stepUpGrantId: string | null
  }
  recovery: boolean
  reason: string
  recordedAt: string
  auditEventId: string
}

/** この領域の架空の状態。作業は版の並びで持ち、最後が最新版。 */
export type State = {
  allowed: boolean
  deadLetters: DeadLetter[]
  deliveries: Delivery[]
  batchJobs: BatchJob[]
  connectors: Connector[]
  exchanges: Exchange[]
  companyAudit: CompanyAudit[]
  systemAudit: SystemAudit[]
  policy: Policy | null
  workItems: WorkItem[][]
  disabledFeatures: string[]
  erasures: { applicationId: number; executed: boolean }[]
}

const DIGEST = "a".repeat(64)
const ME = "11111111-1111-4111-8111-111111111111"
const OTHER = "22222222-2222-4222-8222-222222222222"
const THIRD = "33333333-3333-4333-8333-333333333333"
const human = (accountId: string): Actor => ({
  accountId,
  principalId: `principal-${accountId.slice(-1)}`,
  kind: "human",
})
const at = (day: number, hour = 9, minute = 0) =>
  new Date(Date.UTC(2026, 10, day, hour, minute)).toISOString()
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`

function json(body: unknown, status = 200) {
  return Response.json(body, { status })
}

function failure(status: number, code: string) {
  return Response.json({ code, detail: code }, { status })
}

export const area = defineMockArea<State>({
  name: "operations",
  seed: (scenario) => seed(scenario),
  handle: (request) => {
    const { state, path, method, query, body } = request
    const parts = path.split("/").filter(Boolean)

    if (path === "/system/health" && method === "GET") return json({ status: "ok" })
    if (path === "/company/features" && method === "GET")
      return json({ disabled_features: state.disabledFeatures })
    if (path === "/system/step-up-grants" && method === "POST") {
      if (body.method === "password" && body.password !== "example-password")
        return failure(401, "invalid_credentials")
      return json(
        {
          step_up_token: "0".repeat(64),
          method: "password",
          expires_at: new Date(Date.now() + 300_000).toISOString(),
        },
        201,
      )
    }

    if (parts[0] === "system" && parts[1] === "work-items") return handleWork(request)

    const guarded =
      path.startsWith("/system/dead-letters") ||
      path.startsWith("/system/deliveries") ||
      path.startsWith("/system/batch-jobs") ||
      path.startsWith("/system/connectors") ||
      path.startsWith("/system/integration-exchanges") ||
      path.startsWith("/system/audit-") ||
      path.startsWith("/company/audit-") ||
      path.startsWith("/company/personal-data-erasure-requests")
    if (!guarded) return null
    if (!state.allowed) return failure(403, "forbidden")

    if (path === "/system/dead-letters" && method === "GET")
      return json({ dead_letters: state.deadLetters })
    if (parts[1] === "dead-letters" && parts[3] === "requeue" && method === "POST") {
      const item = state.deadLetters.find((letter) => letter.id === parts[2])
      if (item === undefined) return failure(404, "not_found")
      if (typeof body.reason !== "string" || body.reason.trim() === "")
        return failure(400, "invalid")
      if (item.requeued_job_id !== null)
        return json({ job_id: item.requeued_job_id, replayed: true })
      item.requeued_job_id = crypto.randomUUID()
      item.requeued_at = new Date().toISOString()
      return json({ job_id: item.requeued_job_id, replayed: false }, 201)
    }

    if (path === "/system/deliveries" && method === "GET") {
      const kind = query.get("kind")
      if (kind !== "job" && kind !== "outbox") return failure(400, "invalid")
      const status = query.get("status")
      return json({
        deliveries: state.deliveries.filter(
          (item) => item.kind === kind && (status === null || item.status === status),
        ),
      })
    }
    if (parts[1] === "deliveries" && parts.length === 3 && method === "PATCH") {
      const item = state.deliveries.find((delivery) => delivery.id === parts[2])
      if (item === undefined) return failure(404, "not_found")
      if (body.action !== "recover") return failure(403, "forbidden")
      const expired =
        item.status === "leased" &&
        item.lease_expires_at !== null &&
        Date.parse(item.lease_expires_at) <= Date.now()
      if (!expired) return failure(409, "delivery_conflict")
      const now = new Date().toISOString()
      const terminal = item.attempt >= item.max_attempts
      Object.assign(item, {
        status: terminal ? "dead_letter" : "queued",
        available_at: now,
        lease_account_id: null,
        lease_expires_at: null,
        last_error_code: "lease.expired",
        updated_at: now,
        completed_at: terminal ? now : null,
      })
      return json({ delivery: item })
    }

    if (path === "/system/batch-jobs" && method === "GET")
      return json({ data: state.batchJobs, total: state.batchJobs.length })

    if (path === "/system/connectors" && method === "GET")
      return json({ connectors: state.connectors })
    if (path === "/system/connectors" && method === "POST") {
      if (typeof body.key !== "string" || !/^[a-z][a-z0-9_-]{0,62}$/.test(body.key))
        return failure(400, "invalid")
      if (state.connectors.some((item) => item.key === body.key))
        return failure(409, "integration_conflict")
      const now = new Date().toISOString()
      const connector: Connector = {
        id: String(body.id),
        key: body.key,
        name: String(body.name),
        direction: body.direction as Connector["direction"],
        transport: body.transport as Connector["transport"],
        status: "active",
        revision: 1,
        created_at: now,
        updated_at: now,
      }
      state.connectors.push(connector)
      return json({ connector, replayed: false }, 201)
    }
    if (parts[1] === "connectors" && parts.length === 3 && method === "PATCH") {
      const item = state.connectors.find((connector) => connector.id === parts[2])
      if (item === undefined) return failure(404, "not_found")
      if (body.expected_revision !== item.revision) return failure(409, "integration_conflict")
      Object.assign(item, {
        name: String(body.name),
        status: body.status === "disabled" ? "disabled" : "active",
        revision: item.revision + 1,
        updated_at: new Date().toISOString(),
      })
      return json({ connector: item })
    }

    if (path === "/system/integration-exchanges" && method === "GET") {
      const connectorId = query.get("connector_id")
      return json({
        exchanges: state.exchanges.filter((item) => item.connector_id === connectorId),
      })
    }
    if (parts[1] === "integration-exchanges" && parts.length === 3) {
      const item = state.exchanges.find((exchange) => exchange.id === parts[2])
      if (item === undefined) return failure(404, "not_found")
      if (method === "GET") return json({ exchange: item })
      if (method === "PATCH") {
        if (body.status !== "pending" || item.status !== "failed")
          return failure(400, "invalid_transition")
        Object.assign(item, {
          status: "pending",
          attempt: item.attempt + 1,
          last_error_code: null,
          updated_at: new Date().toISOString(),
          completed_at: null,
        })
        return json({ exchange: item })
      }
    }

    if (path === "/company/audit-events" && method === "GET") {
      const filtered = state.companyAudit.filter(
        (item) =>
          (query.get("action") === null || item.action === query.get("action")) &&
          (query.get("outcome") === null || item.outcome === query.get("outcome")) &&
          (query.get("actor_account_id") === null ||
            item.actor_account_id === query.get("actor_account_id")) &&
          (query.get("from") === null ||
            Date.parse(item.created_at) >= Date.parse(query.get("from")!)) &&
          (query.get("to") === null || Date.parse(item.created_at) < Date.parse(query.get("to")!)),
      )
      const limit = Number(query.get("limit") ?? 50)
      const start = Number(query.get("cursor") ?? 0)
      const page = filtered.slice(start, start + limit)
      return json({
        data: page.map(
          ({
            authorization_json: _a,
            before_json: _b,
            after_json: _c,
            metadata_json: _d,
            client_ip: _e,
            ...rest
          }) => rest,
        ),
        next_cursor: start + limit < filtered.length ? String(start + limit) : null,
        previous_cursor: start > 0 ? String(Math.max(0, start - limit)) : null,
      })
    }
    if (parts[0] === "company" && parts[1] === "audit-events" && parts.length === 3) {
      const item = state.companyAudit.find((event) => event.event_id === parts[2])
      return item === undefined ? failure(404, "audit_event_not_found") : json(item)
    }
    if (path === "/company/audit-event-exports" && method === "POST") {
      const from = Date.parse(String(body.from))
      const to = Date.parse(String(body.to))
      if (!(from < to) || to - from > 31 * 86_400_000)
        return failure(400, "audit_invalid_export_range")
      const rows = state.companyAudit.filter(
        (item) => Date.parse(item.created_at) >= from && Date.parse(item.created_at) < to,
      )
      const csv = [
        "event_id,action,outcome,created_at",
        ...rows.map((row) => [row.event_id, row.action, row.outcome, row.created_at].join(",")),
      ].join("\n")
      return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8" } })
    }

    if (path === "/system/audit-events" && method === "GET") {
      const filtered = state.systemAudit.filter(
        (item) =>
          (query.get("action") === null || item.action === query.get("action")) &&
          (query.get("outcome") === null || item.outcome === query.get("outcome")) &&
          (query.get("actor_account_id") === null ||
            item.actor_account_id === query.get("actor_account_id")) &&
          (query.get("occurred_from") === null ||
            Date.parse(item.occurred_at) >= Date.parse(query.get("occurred_from")!)) &&
          (query.get("occurred_to") === null ||
            Date.parse(item.occurred_at) < Date.parse(query.get("occurred_to")!)),
      )
      const limit = Number(query.get("limit") ?? 50)
      const offset = Number(query.get("offset") ?? 0)
      return json({
        events: filtered.slice(offset, offset + limit),
        total: filtered.length,
        limit,
        offset,
        boundary: "example-boundary",
      })
    }
    if (parts[0] === "system" && parts[1] === "audit-events" && parts.length === 3) {
      const item = state.systemAudit.find((event) => event.event_id === parts[2])
      return item === undefined ? failure(404, "audit_event_not_found") : json(item)
    }
    if (path === "/system/audit-disclosure-policies" && method === "GET")
      return json({ policy: query.get("scope") === "*" ? state.policy : null })
    if (path === "/system/audit-disclosure-policies" && method === "POST") {
      const revision = state.policy?.revision ?? 0
      if (body.expectedRevision !== revision) return failure(409, "conflict")
      state.policy = {
        scope: String(body.scope),
        commandId: String(body.commandId),
        enabled: body.enabled === true,
        allowedFields: Array.isArray(body.allowedFields) ? (body.allowedFields as string[]) : [],
        allowedTargetTypes: (body.allowedTargetTypes as string[] | null) ?? null,
        allowedPurposes: (body.allowedPurposes as string[] | null) ?? null,
        expiresAt: (body.expiresAt as string | null) ?? null,
        reason: String(body.reason),
        actorAccountId: ME,
        revision: revision + 1,
        recordedAt: new Date().toISOString(),
        auditEventId: crypto.randomUUID(),
      }
      return json({ policy: state.policy, replayed: false }, 201)
    }

    if (path === "/company/personal-data-erasure-requests" && method === "POST") {
      if (typeof body.reason !== "string" || body.reason.trim() === "")
        return failure(400, "invalid")
      const applicationId = 900 + state.erasures.length + 1
      state.erasures.push({ applicationId, executed: false })
      return json(
        {
          application_id: applicationId,
          request_id: String(body.request_id),
          status: "pending",
          current_step: "approval",
        },
        201,
      )
    }
    if (
      parts[1] === "personal-data-erasure-requests" &&
      parts[3] === "execute" &&
      method === "POST"
    ) {
      const item = state.erasures.find((erasure) => erasure.applicationId === Number(parts[2]))
      if (item === undefined) return failure(404, "application_not_found")
      const status = item.executed ? "replayed" : "destroyed"
      item.executed = true
      return json({ status, attachment_ids: ["example-attachment-1"] })
    }
    return null
  },
})

/** 作業の一覧・一件・履歴と、版を進める操作。 */
function handleWork(request: {
  state: State
  path: string
  method: string
  body: Record<string, unknown>
}) {
  const { state, method, body } = request
  const parts = request.path.split("/").filter(Boolean)
  const id = parts[2]
  const command = parts.slice(3).join("/")

  if (parts.length === 2 && method === "GET")
    return json({
      workItems: state.workItems.map((revisions) => revisions.at(-1)!),
      nextCursor: null,
    })
  if (parts.length === 2 && method === "POST") {
    if (
      typeof body.assigneeAccountId !== "string" ||
      !/^[0-9a-f-]{36}$/.test(body.assigneeAccountId)
    )
      return failure(400, "invalid")
    const now = new Date().toISOString()
    const item: WorkItem = {
      ...base(String(body.id), 1, "create", ME),
      title: String(body.title),
      instructions: String(body.instructions),
      acceptanceCriteria: String(body.acceptanceCriteria),
      dueAt: (body.dueAt as string | null) ?? null,
      assignee: human(body.assigneeAccountId),
      reason: String(body.reason),
      createdAt: now,
      recordedAt: now,
    }
    state.workItems.push([item])
    return json({ workItem: item, replayed: false }, 201)
  }

  const revisions = state.workItems.find((list) => list[0]!.id === id)
  if (revisions === undefined) return failure(404, "not_found")
  const current = revisions.at(-1)!
  if (parts.length === 3 && method === "GET") return json({ workItem: current })
  if (command === "history" && method === "GET")
    return json({ revisions: [...revisions].reverse(), nextRevision: null })
  if (method !== "POST") return null
  if (body.expectedRevision !== current.revision) return failure(409, "conflict")

  const next = (changes: Partial<WorkItem> & { action: string }) => {
    const now = new Date().toISOString()
    const item: WorkItem = {
      ...current,
      ...changes,
      revision: current.revision + 1,
      commandId: String(body.commandId),
      actor: human(ME),
      reason: String(body.reason),
      recordedAt: now,
      auditEventId: crypto.randomUUID(),
    }
    revisions.push(item)
    return json({ workItem: item, replayed: false }, 201)
  }
  const open = current.state !== "completed" && current.state !== "cancelled"

  if (command === "accept" && current.state === "offered")
    return next({ action: "accept", state: "active" })
  if (command === "results" && current.state === "active") {
    const result = body.result as { summary?: unknown } | undefined
    return next({
      action: "submit",
      state: "review_pending",
      result: {
        id: crypto.randomUUID(),
        digest: DIGEST,
        summary: typeof result?.summary === "string" ? result.summary : "",
        evidence: [],
        submittedAt: new Date().toISOString(),
        submittedBy: human(ME),
      },
    })
  }
  if ((command === "approve" || command === "return") && current.state === "review_pending") {
    if (body.resultId !== current.result?.id) return failure(409, "conflict")
    return command === "approve"
      ? next({ action: "approve", state: "completed" })
      : next({ action: "return", state: "active", result: null })
  }
  if (command === "cancel" && open) return next({ action: "cancel", state: "cancelled" })
  if (command === "handovers" && open && current.handover === null) {
    if (typeof body.toAccountId !== "string") return failure(400, "invalid")
    return next({
      action: "request_handover",
      handover: {
        id: crypto.randomUUID(),
        to: human(body.toAccountId),
        requestedBy: human(ME),
        requestedAt: new Date().toISOString(),
        reason: String(body.reason),
      },
    })
  }
  if (
    (command === "handovers/accept" || command === "handovers/decline") &&
    current.handover !== null
  ) {
    if (body.handoverId !== current.handover.id) return failure(409, "conflict")
    return command === "handovers/accept"
      ? next({ action: "accept_handover", accountable: current.handover.to, handover: null })
      : next({ action: "decline_handover", handover: null })
  }
  return failure(409, "conflict")
}

function base(id: string, revision: number, action: string, by: string): WorkItem {
  return {
    id,
    revision,
    commandId: crypto.randomUUID(),
    requestDigest: DIGEST,
    action,
    title: "",
    instructions: "",
    acceptanceCriteria: "",
    dueAt: null,
    previousRevisionId: null,
    createdBy: human(by),
    createdAt: at(1),
    assignee: human(OTHER),
    accountable: human(ME),
    state: "offered",
    result: null,
    handover: null,
    actor: human(by),
    authentication: { tokenVersion: 1, credentialId: null, stepUpGrantId: null },
    recovery: false,
    reason: "依頼します",
    recordedAt: at(1),
    auditEventId: uuid(9000 + revision),
  }
}

/** 一つの作業の版を、依頼から順に作る。 */
function workItem(
  n: number,
  title: string,
  steps: ReadonlyArray<Partial<WorkItem> & { action: string; day: number }>,
  dueAt: string | null,
): WorkItem[] {
  const first: WorkItem = {
    ...base(uuid(n), 1, "create", ME),
    title,
    instructions: `${title}の手順に沿って進めてください。`,
    acceptanceCriteria: "結果を一覧にまとめ、確認できる形で提出すること。",
    dueAt,
  }
  const list = [first]
  for (const { day, ...step } of steps) {
    const previous = list.at(-1)!
    list.push({
      ...previous,
      ...step,
      revision: previous.revision + 1,
      commandId: uuid(n * 100 + previous.revision),
      actor: step.actor ?? human(OTHER),
      reason: step.reason ?? "進めます",
      recordedAt: at(day),
      auditEventId: uuid(n * 1000 + previous.revision),
    })
  }
  return list
}

function seed(scenario: Scenario): State {
  const allowed = scenario !== "member"
  if (scenario === "empty")
    return {
      allowed,
      deadLetters: [],
      deliveries: [],
      batchJobs: [],
      connectors: [],
      exchanges: [],
      companyAudit: [],
      systemAudit: [],
      policy: null,
      workItems: [],
      disabledFeatures: [],
      erasures: [],
    }
  const connectorA = uuid(101)
  const connectorB = uuid(102)
  const delivery = (
    n: number,
    kind: Delivery["kind"],
    operation: string,
    status: Delivery["status"],
    changes: Partial<Delivery> = {},
  ): Delivery => ({
    id: uuid(n),
    kind,
    operation_key: operation,
    handler_key: null,
    payload_digest: DIGEST,
    idempotency_key: `example-${n}`,
    status,
    attempt: status === "queued" ? 0 : 1,
    max_attempts: 5,
    available_at: at(13),
    lease_account_id: null,
    lease_expires_at: null,
    last_error_code: null,
    created_at: at(12),
    updated_at: at(13),
    completed_at: status === "succeeded" || status === "dead_letter" ? at(13) : null,
    ...changes,
  })
  const exchange = (
    n: number,
    status: Exchange["status"],
    changes: Partial<Exchange> = {},
  ): Exchange => ({
    id: uuid(n),
    connector_id: connectorA,
    direction: "outbound",
    operation_key: "example.members.sync",
    idempotency_key: `example-exchange-${n}`,
    payload_digest: DIGEST,
    status,
    attempt: 1,
    external_reference: status === "succeeded" ? `EX-${n}` : null,
    last_error_code: status === "failed" ? "remote.timeout" : null,
    created_at: at(12, 9, n % 60),
    updated_at: at(13, 9, n % 60),
    completed_at: status === "pending" ? null : at(13, 9, n % 60),
    ...changes,
  })
  const companyActions = [
    ["employee.update", "employee", "E-1001", "succeeded"],
    ["audit.export", "audit_event", null, "succeeded"],
    ["application.approve", "application", "101", "succeeded"],
    ["organization.update", "department", "D-10", "denied"],
    ["account.role_binding.create", "account", OTHER, "succeeded"],
    ["application.reject", "application", "104", "failed"],
    ["employee.create", "employee", "E-1002", "succeeded"],
    ["personal_data.erasure.request", "attachment", "example-attachment-1", "succeeded"],
  ] as const
  return {
    allowed,
    deadLetters: [
      {
        id: uuid(201),
        source_type: "outbox",
        source_id: uuid(311),
        payload_digest: DIGEST,
        reason_code: "remote.rejected",
        attempt: 5,
        recorded_at: at(13, 22, 10),
        requeued_job_id: null,
        requeued_at: null,
      },
      {
        id: uuid(202),
        source_type: "job",
        source_id: uuid(301),
        payload_digest: DIGEST,
        reason_code: "handler.timeout",
        attempt: 5,
        recorded_at: at(12, 3, 0),
        requeued_job_id: null,
        requeued_at: null,
      },
      {
        id: uuid(203),
        source_type: "job",
        source_id: uuid(305),
        payload_digest: DIGEST,
        reason_code: "handler.timeout",
        attempt: 3,
        recorded_at: at(8, 3, 0),
        requeued_job_id: uuid(306),
        requeued_at: at(8, 10, 0),
      },
    ],
    deliveries: [
      delivery(301, "job", "example.report.monthly", "dead_letter", {
        attempt: 5,
        last_error_code: "handler.timeout",
      }),
      delivery(302, "job", "example.attachment.scan", "leased", {
        lease_account_id: THIRD,
        lease_expires_at: at(13, 10, 0),
      }),
      delivery(303, "job", "example.notification.digest", "queued"),
      delivery(304, "job", "example.report.daily", "succeeded"),
      delivery(306, "job", "system.dead_letter.reprocess.job", "succeeded"),
      delivery(311, "outbox", "example.members.changed", "dead_letter", {
        attempt: 5,
        last_error_code: "remote.rejected",
      }),
      delivery(312, "outbox", "example.application.decided", "succeeded"),
    ],
    batchJobs: [
      {
        id: "batch-5",
        name: "example.attachment.purge",
        status: "failed",
        started_at: at(14, 0, 0),
        finished_at: at(14, 0, 4),
        message: "保存先に接続できませんでした",
      },
      {
        id: "batch-4",
        name: "example.notification.digest",
        status: "running",
        started_at: at(14, 0, 30),
        finished_at: null,
        message: null,
      },
      {
        id: "batch-3",
        name: "example.report.daily",
        status: "completed",
        started_at: at(13, 0, 0),
        finished_at: at(13, 0, 2),
        message: null,
      },
    ],
    connectors: [
      {
        id: connectorA,
        key: "example-directory",
        name: "Example 名簿の連携",
        direction: "outbound",
        transport: "api",
        status: "active",
        revision: 2,
        created_at: at(1),
        updated_at: at(5),
      },
      {
        id: connectorB,
        key: "example-files",
        name: "Example ファイルの受け取り",
        direction: "inbound",
        transport: "file",
        status: "disabled",
        revision: 3,
        created_at: at(1),
        updated_at: at(10),
      },
    ],
    exchanges: [
      exchange(401, "succeeded"),
      exchange(402, "failed", { attempt: 2 }),
      exchange(403, "pending"),
      exchange(404, "failed"),
      exchange(405, "cancelled"),
    ],
    companyAudit: companyActions.map(([action, targetType, targetId, outcome], index) => ({
      event_id: `company-event-${index + 1}`,
      request_id: `request-${index + 1}`,
      actor_account_id: index % 3 === 2 ? OTHER : ME,
      actor_employee_id: index % 3 === 2 ? null : "E-0001",
      action,
      target_type: targetType,
      target_id: targetId,
      outcome,
      reason_code: outcome === "succeeded" ? null : "forbidden",
      client_name: (["web", "cli", "api", "system"] as const)[index % 4]!,
      created_at: at(13 - Math.floor(index / 2), 9 + index, 0),
      authorization_json: '{"required_permission_keys":["employee:write"]}',
      before_json: index === 0 ? '{"position":"メンバー"}' : null,
      after_json: index === 0 ? '{"position":"リーダー"}' : null,
      metadata_json: null,
      client_ip: "192.0.2.10",
    })),
    systemAudit: [
      ["system.connector.updated", "system:connector", connectorB, "succeeded"],
      ["system.dead_letter.requeued", "system:dead_letter", uuid(203), "succeeded"],
      ["system.audit.list", "system:audit-event", null, "denied"],
      ["system.work_item.approve", "system:work_item", uuid(504), "succeeded"],
      ["system.outbox.fail", "system:outbox_message", uuid(311), "failed"],
    ].map(([action, targetType, targetId, outcome], index) => ({
      event_id: uuid(600 + index),
      actor_account_id: index === 2 ? null : ME,
      action: action!,
      target_type: targetType!,
      target_id: targetId ?? null,
      outcome: outcome as Outcome,
      reason_code: outcome === "succeeded" ? null : "forbidden",
      authorization_json: null,
      before_json: index === 0 ? '{"status":"active"}' : null,
      after_json: index === 0 ? '{"status":"disabled"}' : null,
      metadata_json: null,
      occurred_at: at(13 - index, 12, 0),
      redacted_fields: index === 2 ? ["actor_account_id", "metadata_json"] : [],
    })),
    policy: {
      scope: "*",
      commandId: uuid(701),
      enabled: true,
      allowedFields: ["actor_account_id", "reason_code", "target_id"],
      allowedTargetTypes: null,
      allowedPurposes: ["監査対応"],
      expiresAt: null,
      reason: "監査対応のため、操作した人と対象を開示する",
      actorAccountId: ME,
      revision: 2,
      recordedAt: at(3),
      auditEventId: uuid(702),
    },
    workItems: [
      workItem(
        501,
        "Example 月次の権限の棚卸し",
        [
          { action: "accept", state: "active", day: 2 },
          {
            action: "submit",
            state: "review_pending",
            day: 9,
            result: {
              id: uuid(5011),
              digest: DIGEST,
              summary: "権限を持つ12件を確かめ、不要な2件を外しました。",
              evidence: [],
              submittedAt: at(9),
              submittedBy: human(OTHER),
            },
          },
        ],
        at(10),
      ),
      workItem(502, "Example 退職者のアカウントの停止", [], at(20)),
      workItem(
        503,
        "Example 外部接続の設定の見直し",
        [
          { action: "accept", state: "active", day: 3 },
          {
            action: "request_handover",
            day: 11,
            actor: human(ME),
            handover: {
              id: uuid(5031),
              to: human(THIRD),
              requestedBy: human(ME),
              requestedAt: at(11),
              reason: "担当の部署が変わるため",
            },
          },
        ],
        null,
      ),
      workItem(
        504,
        "Example 監査記録の保存の確認",
        [
          { action: "accept", state: "active", day: 2 },
          {
            action: "submit",
            state: "review_pending",
            day: 4,
            result: {
              id: uuid(5041),
              digest: DIGEST,
              summary: "保存期間を満たしていることを確かめました。",
              evidence: [],
              submittedAt: at(4),
              submittedBy: human(OTHER),
            },
          },
          { action: "approve", state: "completed", day: 5, actor: human(ME) },
        ],
        at(6),
      ),
      workItem(
        505,
        "Example 古い添付の整理",
        [
          {
            action: "cancel",
            state: "cancelled",
            day: 4,
            actor: human(ME),
            reason: "別の作業にまとめるため",
          },
        ],
        null,
      ),
    ],
    disabledFeatures: ["example-optional-app"],
    erasures: [{ applicationId: 900, executed: false }],
  }
}
