import type {
  ReviewContext,
  ReviewCommand,
} from "@/contexts/performance-review/configuration/review-context"
import { ReviewSheetEntity } from "@/contexts/performance-review/domain/entities/review-sheet.entity"
import { ReviewError } from "@/contexts/performance-review/domain/errors"
import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"

export class ReviewSheetRepository {
  constructor(private readonly c: ReviewContext) {}
  async find(id: string) {
    const row = await this.c.env.DB.prepare(
      "SELECT snapshot_json FROM performance_review_sheets WHERE id = ?",
    )
      .bind(id)
      .first<{ snapshot_json: string }>()
    return row === null ? null : ReviewSheetEntity.restore(JSON.parse(row.snapshot_json))
  }
  async list(cycleId: string | undefined, all: boolean, limit = 50, offset = 0) {
    const rows = await this.c.env.DB.prepare(
      `SELECT snapshot_json FROM performance_review_sheets WHERE (?1 IS NULL OR cycle_id = ?1) AND (?2 = 1 OR owner_account_id = ?3) ORDER BY updated_at DESC, id LIMIT ?4 OFFSET ?5`,
    )
      .bind(cycleId ?? null, all ? 1 : 0, this.c.actor.accountId, limit, offset)
      .all<{ snapshot_json: string }>()
    return rows.results.map((row) => ReviewSheetEntity.restore(JSON.parse(row.snapshot_json)).data)
  }
  async replay(command: ReviewCommand) {
    const row = await this.c.env.DB.prepare(
      "SELECT command_digest, snapshot_json FROM performance_review_sheet_revisions WHERE actor_account_id = ? AND idempotency_key = ?",
    )
      .bind(this.c.actor.accountId, command.idempotencyKey)
      .first<{ command_digest: string; snapshot_json: string }>()
    if (row === null) return null
    if (row.command_digest !== command.digest) throw new ReviewError(409, "idempotency_key_reused")
    return ReviewSheetEntity.restore(JSON.parse(row.snapshot_json)).data
  }
  async verify(guards: ReadonlyArray<D1PreparedStatement>) {
    try {
      await this.c.env.DB.batch([...guards])
    } catch {
      throw new ReviewError(409, "review_authorization_changed")
    }
  }
  guard(id: string, revision: number) {
    return this.c.env.DB.prepare(
      `SELECT CASE WHEN EXISTS (SELECT 1 FROM performance_review_sheets WHERE id = ?1 AND revision = ?2) THEN 1 ELSE json_extract('{}', 'review_revision_conflict') END`,
    ).bind(id, revision)
  }
  statements(
    sheet: ReviewSheetEntity,
    expectedRevision: number,
    command: ReviewCommand,
    reflection?:
      | { kind: "submission"; seriesId: string }
      | { kind: "decision"; caseId: string; phase: "goals" | "evaluation" },
  ) {
    const db = this.c.env.DB,
      data = sheet.data
    const parameters: (string | number)[] = [JSON.stringify(data)]
    let expression = "?1"
    if (reflection?.kind === "submission") {
      parameters.push(reflection.seriesId)
      expression =
        "json_set(?1, '$.approval.number', (SELECT number FROM system_proposal_numbers WHERE series_id = ?2))"
    } else if (reflection?.kind === "decision") {
      parameters.push(reflection.caseId)
      const phase = reflection.phase
      expression = `json_set(?1, '$.status', (SELECT CASE status WHEN 'approved' THEN '${phase === "goals" ? "goals_approved" : "finalized"}' WHEN 'returned' THEN '${phase}_returned' WHEN 'rejected' THEN '${phase}_rejected' ELSE '${phase}_pending' END FROM system_cases WHERE id = ?2))`
    }
    const idIndex = parameters.length + 1
    parameters.push(data.id, expectedRevision)
    const write =
      expectedRevision === 0
        ? db
            .prepare(`WITH snapshot(value) AS (SELECT ${expression})
          INSERT INTO performance_review_sheets (id, cycle_id, owner_account_id, employee_id, revision, status, snapshot_json, created_at, updated_at)
          SELECT json_extract(value, '$.id'), json_extract(value, '$.cycle_id'), json_extract(value, '$.owner_account_id'), json_extract(value, '$.employee_id'), json_extract(value, '$.revision'), json_extract(value, '$.status'), value, json_extract(value, '$.created_at'), json_extract(value, '$.updated_at') FROM snapshot`)
            .bind(...parameters.slice(0, idIndex - 1))
        : db
            .prepare(`WITH snapshot(value) AS (SELECT ${expression})
          UPDATE performance_review_sheets SET (revision, status, snapshot_json, updated_at) =
          (SELECT json_extract(value, '$.revision'), json_extract(value, '$.status'), value, json_extract(value, '$.updated_at') FROM snapshot)
          WHERE id = ?${idIndex} AND revision = ?${idIndex + 1}`)
            .bind(...parameters)
    return [
      write,
      abortWhenPreviousStatementChangedNoRows(db),
      db
        .prepare(`INSERT INTO performance_review_sheet_revisions
      (sheet_id, revision, actor_account_id, operation, reason, detail_json, snapshot_json, command_digest, idempotency_key, request_id, created_at)
      SELECT id, revision, ?, ?, ?, ?, snapshot_json, ?, ?, ?, updated_at FROM performance_review_sheets WHERE id = ? AND revision = ?`)
        .bind(
          this.c.actor.accountId,
          command.operation,
          command.reason,
          JSON.stringify(command.detail),
          command.digest,
          command.idempotencyKey,
          this.c.var.auditContext.requestId,
          data.id,
          data.revision,
        ),
    ]
  }
  async save(
    sheet: ReviewSheetEntity,
    expectedRevision: number,
    command: ReviewCommand,
    guards: ReadonlyArray<D1PreparedStatement>,
  ) {
    const replay = await this.replay(command)
    if (replay !== null) {
      await this.verify(guards)
      return replay
    }
    try {
      await this.c.env.DB.batch([...guards, ...this.statements(sheet, expectedRevision, command)])
    } catch {
      const replay = await this.replay(command)
      if (replay !== null) {
        await this.verify(guards)
        return replay
      }
      throw new ReviewError(409, "review_write_conflict")
    }
    return sheet.data
  }
  async history(id: string, limit = 50, offset = 0) {
    const rows = await this.c.env.DB.prepare(
      `SELECT revision, actor_account_id, operation, reason, detail_json, snapshot_json, request_id, created_at FROM performance_review_sheet_revisions WHERE sheet_id = ? ORDER BY revision LIMIT ? OFFSET ?`,
    )
      .bind(id, limit, offset)
      .all<{ detail_json: string; snapshot_json: string; [key: string]: unknown }>()
    return rows.results.map(({ detail_json, snapshot_json, ...row }) => ({
      ...row,
      detail: JSON.parse(detail_json),
      snapshot: JSON.parse(snapshot_json),
    }))
  }
}
