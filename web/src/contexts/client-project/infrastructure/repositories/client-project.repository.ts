import type { ClientProjectCommand } from "@/contexts/client-project/domain/client-project-command"
import { ClientProjectError } from "@/contexts/client-project/domain/errors"
import { SystemAuditEventEntity } from "@system/domain/entities/system-audit-event.entity"
import { prepareSystemAuditEventAppend } from "@system/interface/operations/prepare-system-audit-event-append"

type Context = Readonly<{
  db: D1Database
  guards: ReadonlyArray<D1PreparedStatement>
  accountId: string
  employeeId: string
  requestId: string
  now: Date
}>
type Query = Readonly<{
  kind: ClientProjectCommand["kind"]
  id?: string
  project_id?: string
  customer_id?: string
  search?: string
  history: boolean
  offset: number
  limit: number
}>
type Row = Readonly<{
  revision: number
  employee_id: string
  snapshot_json: string
  recorded_at: string
  request_id: string
  actor_account_id: string
  reason: string
  actual_minutes: number | null
  baseline_minutes: number | null
}>

export class ClientProjectRepository {
  constructor(private readonly c: Context) {}

  async list(query: Query) {
    const db = this.c.db
    const source = query.history
      ? "client_project_records r JOIN client_project_revisions v ON r.id = v.record_id"
      : "client_project_current v JOIN client_project_records r ON r.id = v.record_id"
    const statement = db
      .prepare(`
      SELECT v.revision, r.employee_id, v.snapshot_json, v.recorded_at, v.request_id, v.actor_account_id, v.reason,
        CASE WHEN r.kind = 'project' AND ?5 = 0 THEN (
          SELECT coalesce(sum(json_extract(e.snapshot_json, '$.minutes')), 0)
          FROM client_project_current e
          WHERE e.project_id = r.id AND e.kind = 'effort' AND json_extract(e.snapshot_json, '$.status') = 'recorded'
        ) END AS actual_minutes,
        CASE WHEN r.kind = 'project' THEN (
          SELECT json_extract(initial.snapshot_json, '$.planned_minutes') FROM client_project_revisions initial
          WHERE initial.record_id = r.id AND initial.revision = 1
        ) END AS baseline_minutes
      FROM ${source}
      WHERE r.kind = ?1 AND (?2 IS NULL OR r.id = ?2) AND (?3 IS NULL OR v.project_id = ?3)
        AND (?7 IS NULL OR v.customer_id = ?7)
        AND (?8 IS NULL OR instr(lower(json_extract(v.snapshot_json, '$.name')), lower(?8)) > 0)
      ORDER BY r.id, v.revision DESC LIMIT ?4 OFFSET ?6
    `)
      .bind(
        query.kind,
        query.id ?? null,
        query.project_id ?? null,
        query.limit,
        Number(query.history),
        query.offset,
        query.customer_id ?? null,
        query.search ?? null,
      )
    const [result] = await db.batch<Row>([statement, ...this.c.guards])
    return result!.results.map((row) => this.present(row))
  }

  async save(command: ClientProjectCommand, key: string) {
    const db = this.c.db
    const snapshot = JSON.stringify(command)
    const revision = command.expected_revision + 1
    const create = db
      .prepare("INSERT INTO client_project_records(id, kind, employee_id) VALUES (?, ?, ?)")
      .bind(command.id, command.kind, this.c.employeeId)
    const append = db
      .prepare(`
      INSERT INTO client_project_revisions
        (record_id, revision, actor_account_id, idempotency_key, reason, recorded_at, request_id, snapshot_json)
      VALUES (
        (SELECT r.id FROM client_project_records r
         WHERE r.id = ? AND r.kind = ? AND (r.kind != 'effort' OR r.employee_id = ?)),
        ?, ?, ?, ?, ?, ?, ?
      )
    `)
      .bind(
        command.id,
        command.kind,
        this.c.employeeId,
        revision,
        this.c.accountId,
        key,
        command.reason,
        this.c.now.toISOString(),
        this.c.requestId,
        snapshot,
      )
    const writes = command.expected_revision === 0 ? [create, append] : [append]
    const event = SystemAuditEventEntity.create({
      actorAccountId: this.c.accountId,
      action: "client_project.record.saved",
      targetType: "client_project_record",
      targetId: command.id,
      outcome: "succeeded",
      reasonCode: null,
      authorizationJson: null,
      beforeJson: null,
      afterJson: null,
      metadataJson: JSON.stringify({ kind: command.kind, revision, request_id: this.c.requestId }),
      occurredAt: this.c.now,
    })
    if (event instanceof Error)
      throw new ClientProjectError(503, "client_project_audit_unavailable")
    const audit = prepareSystemAuditEventAppend({ database: db, event })
    try {
      await db.batch([...this.c.guards, ...writes, ...audit])
      return { id: command.id, revision }
    } catch (error) {
      const replay = await this.replay(key, snapshot)
      if (replay !== null) return replay
      if (
        !(error instanceof Error) ||
        !/constraint|client_project_revision_conflict/i.test(error.message)
      )
        throw new ClientProjectError(503, "client_project_write_unavailable")
      throw new ClientProjectError(409, "client_project_write_conflict")
    }
  }

  private async replay(key: string, snapshot: string) {
    const statement = this.c.db
      .prepare(
        "SELECT record_id AS id, revision, snapshot_json FROM client_project_revisions WHERE actor_account_id = ? AND idempotency_key = ?",
      )
      .bind(this.c.accountId, key)
    const [result] = await this.c.db.batch<{ id: string; revision: number; snapshot_json: string }>(
      [statement, ...this.c.guards],
    )
    const prior = result?.results[0]
    if (prior === undefined) return null
    if (prior.snapshot_json !== snapshot)
      throw new ClientProjectError(409, "idempotency_key_reused")
    return { id: prior.id, revision: prior.revision }
  }

  private present(row: Row) {
    const command = JSON.parse(row.snapshot_json) as ClientProjectCommand
    const { expected_revision: _, reason: __, ...record } = command
    const actual = row.actual_minutes
    const forecast =
      command.kind === "project" && actual !== null && command.remaining_minutes !== null
        ? actual + command.remaining_minutes
        : null
    return {
      ...record,
      revision: row.revision,
      ...(command.kind === "effort"
        ? { employee_id: row.employee_id }
        : { created_by_employee_id: row.employee_id }),
      recorded_at: row.recorded_at,
      request_id: row.request_id,
      actor_account_id: row.actor_account_id,
      reason: row.reason,
      ...(command.kind === "project"
        ? {
            baseline_minutes: row.baseline_minutes,
            actual_minutes: actual,
            forecast_minutes: forecast,
            variance_minutes:
              forecast !== null && command.planned_minutes !== null
                ? forecast - command.planned_minutes
                : null,
          }
        : {}),
    }
  }
}
