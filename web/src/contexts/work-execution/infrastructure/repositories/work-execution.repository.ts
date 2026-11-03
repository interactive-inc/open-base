import type { z } from "zod"
import type {
  definitionInput,
  definitionQuery,
  executionInput,
  executionQuery,
} from "@/contexts/work-execution/domain/work-execution-input"
import { WorkExecutionConflict } from "@/contexts/work-execution/domain/errors"

type StorageContext = Readonly<{
  database: D1Database
  accountId: string
  machine: boolean
  now: Date
  guards: ReadonlyArray<D1PreparedStatement>
  audit: (target: string, id: string, revision: number) => ReadonlyArray<D1PreparedStatement>
}>

export class WorkExecutionRepository {
  constructor(private readonly c: StorageContext) {}

  async definitions(query: z.infer<typeof definitionQuery>) {
    const statement = this.c.database
      .prepare(`
      SELECT id, revision, snapshot_json, recorded_at FROM work_execution_definitions definition
      WHERE (?1 IS NULL OR slug = ?1)
        AND (?2 IS NULL OR EXISTS (SELECT 1 FROM json_each(snapshot_json, '$.tags') WHERE value = ?2))
        AND revision = coalesce(?5, (SELECT max(latest.revision) FROM work_execution_definitions latest WHERE latest.slug = definition.slug))
      ORDER BY slug LIMIT ?3 OFFSET ?4
    `)
      .bind(
        query.slug ?? null,
        query.tag ?? null,
        query.limit,
        query.offset,
        query.revision ?? null,
      )
    return this.read(statement)
  }

  async executions(query: z.infer<typeof executionQuery>) {
    const statement = this.c.database
      .prepare(`
      SELECT run.agent_id, run.reporter_account_id, run.definition_id, run.received_at, run.snapshot_json, definition.owner_employee_id
      FROM work_execution_runs run JOIN work_execution_definitions definition
        ON definition.id = run.definition_id AND definition.revision = run.definition_revision
      WHERE (?1 IS NULL OR definition.slug = ?1) AND (?2 IS NULL OR run.agent_id = ?2)
        AND (?3 IS NULL OR EXISTS (SELECT 1 FROM json_each(definition.snapshot_json, '$.tags') WHERE value = ?3))
        AND (?4 IS NULL OR EXISTS (SELECT 1 FROM json_each(run.snapshot_json, '$.references') reference
          WHERE json_extract(reference.value, '$.kind') = ?4 AND json_extract(reference.value, '$.id') = ?5))
        AND (?6 IS NULL OR json_extract(run.snapshot_json, '$.started_at') >= ?6)
      ORDER BY run.received_at DESC, run.reporter_account_id, run.id LIMIT ?7 OFFSET ?8
    `)
      .bind(
        query.slug ?? null,
        query.agent_id ?? null,
        query.tag ?? null,
        query.reference_kind ?? null,
        query.reference_id ?? null,
        query.since ?? null,
        query.limit,
        query.offset,
      )
    return this.read(statement)
  }

  async saveDefinition(input: z.infer<typeof definitionInput>) {
    const db = this.c.database
    const revision = input.expected_revision + 1
    const snapshot = JSON.stringify(input)
    const id = crypto.randomUUID()
    const write = db
      .prepare(`
      INSERT INTO work_execution_definitions (id, slug, revision, agent_id, owner_employee_id, status, snapshot_json, actor_account_id, recorded_at)
      VALUES (coalesce((SELECT id FROM work_execution_definitions WHERE slug = ?1 AND revision = 1), ?2),
        ?1, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `)
      .bind(
        input.slug,
        id,
        revision,
        input.agent_id,
        input.owner_employee_id,
        input.status,
        snapshot,
        this.c.accountId,
        this.c.now.toISOString(),
      )
    const replay = db
      .prepare(`
      SELECT id, revision, snapshot_json FROM work_execution_definitions
      WHERE slug = ? AND revision = ? AND actor_account_id = ?
    `)
      .bind(input.slug, revision, this.c.accountId)
    return this.write({
      write,
      replay,
      snapshot,
      audit: this.c.audit("work_definition", input.slug, revision),
    })
  }

  async record(input: z.infer<typeof executionInput>) {
    const db = this.c.database
    const snapshot = JSON.stringify(input)
    const write = db
      .prepare(`
      INSERT INTO work_execution_runs (reporter_account_id, agent_id, id, definition_id, definition_revision, snapshot_json, received_at)
      VALUES (
        ?1,
        CASE WHEN ?8 = 1 THEN (SELECT principal.id FROM system_principals principal
          WHERE principal.account_id = ?1 AND principal.kind = 'agent') END,
        ?2,
        (SELECT definition.id FROM work_execution_definitions definition
         WHERE definition.slug = ?3 AND definition.revision = ?4 AND definition.status = 'active'
           AND (?8 = 0 OR EXISTS (SELECT 1 FROM system_principals principal
             WHERE principal.id = definition.agent_id AND principal.account_id = ?1 AND principal.kind = 'agent'))
           AND NOT EXISTS (SELECT 1 FROM work_execution_definitions later WHERE later.slug = ?3 AND later.revision > ?4)
           AND (?7 IS NULL OR EXISTS (SELECT 1 FROM work_execution_runs prior
             WHERE prior.id = ?7 AND prior.reporter_account_id = ?1 AND prior.definition_id = definition.id))),
        ?4, ?5, ?6)
    `)
      .bind(
        this.c.accountId,
        input.id,
        input.slug,
        input.definition_revision,
        snapshot,
        this.c.now.toISOString(),
        input.corrects_id,
        Number(this.c.machine),
      )
    const replay = db
      .prepare(`
      SELECT run.id, run.definition_revision AS revision, run.snapshot_json FROM work_execution_runs run
      WHERE run.reporter_account_id = ? AND run.id = ?
    `)
      .bind(this.c.accountId, input.id)
    return this.write({
      write,
      replay,
      snapshot,
      audit: this.c.audit("work_execution", input.id, input.definition_revision),
    })
  }

  private async write(input: {
    write: D1PreparedStatement
    replay: D1PreparedStatement
    snapshot: string
    audit: ReadonlyArray<D1PreparedStatement>
  }) {
    const db = this.c.database
    try {
      const [result] = await db.batch<{ id: string; revision: number }>([
        ...this.c.guards,
        input.write,
        ...input.audit,
      ])
      if (!result?.success) throw new Error("write failed")
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !/constraint|work_execution_definition_conflict/i.test(error.message)
      )
        throw error
    }
    const [result] = await db.batch<{ id: string; revision: number; snapshot_json: string }>([
      input.replay,
      ...this.c.guards,
    ])
    const prior = result?.results[0]
    if (prior?.snapshot_json !== input.snapshot)
      throw new WorkExecutionConflict("work_execution_conflict")
    return { id: prior.id, revision: prior.revision }
  }

  private async read(statement: D1PreparedStatement) {
    const [result] = await this.c.database.batch<
      { snapshot_json: string } & Record<string, unknown>
    >([statement, ...this.c.guards])
    if (!result?.success) throw new Error("read failed")
    return result.results.map(({ snapshot_json, ...metadata }) => ({
      ...JSON.parse(snapshot_json),
      ...metadata,
    }))
  }
}
