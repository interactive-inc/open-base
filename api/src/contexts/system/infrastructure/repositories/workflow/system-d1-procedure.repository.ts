import { abortWhenPreviousStatementChangedNoRows } from "@/lib/database/abort-when-previous-statement-changed-no-rows"
import { isAbortedByGuard } from "@/lib/database/is-aborted-by-guard"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { InvalidSystemProposalError } from "@system/domain/errors"
import { ProcedureDefinitionEntity } from "@system/domain/entities/procedure-definition.entity"
import type { ProcedureKey } from "@system/domain/schemas/workflow/procedure-key.schema"
import type { SystemD1Context } from "@system/configuration/system-context"

type ProcedureRow = Readonly<{
  procedure_key: string
  revision: number
  title: string
  category: string
  description: string | null
  input_schema_json: string
  decision_policy_json: string
  completion_operation_key: string | null
  created_by_account_id: string
  created_at: number
}>

export type SystemProcedureList = Readonly<{
  definitions: ReadonlyArray<ProcedureDefinitionEntity>
  total: number
}>
type Context = SystemD1Context &
  Readonly<{
    publishGuards?: ReadonlyArray<D1PreparedStatement>
    publishEffects?: ReadonlyArray<D1PreparedStatement>
  }>

/** System手続の版とlifecycleをD1へ永続化する。 */
export class SystemD1ProcedureRepository {
  constructor(private readonly c: Context) {}

  async find(key: ProcedureKey): Promise<ProcedureDefinitionEntity | null | Error> {
    try {
      const row = await this.c.env.DB.prepare(
        `SELECT
             revision.procedure_key,
             revision.revision,
             revision.title,
             revision.category,
             revision.description,
             revision.input_schema_json,
             revision.decision_policy_json,
             revision.completion_operation_key,
             revision.created_by_account_id,
             revision.created_at
           FROM system_procedure_definitions AS definition
           JOIN system_procedure_definition_revisions AS revision
             ON revision.procedure_key = definition.key
            AND revision.revision = definition.current_revision
           WHERE definition.key = ?1 AND definition.status = 'active'`,
      )
        .bind(key)
        .first<ProcedureRow>()

      return row === null ? null : this.restore(row)
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to load system procedure", { cause })
    }
  }

  async findNumber(key: ProcedureKey): Promise<number | null | Error> {
    try {
      return await this.c.env.DB.prepare(
        "SELECT number FROM system_procedure_numbers WHERE procedure_key = ?1",
      )
        .bind(key)
        .first<number>("number")
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to load system procedure number", { cause })
    }
  }

  async hasProposals(key: ProcedureKey): Promise<boolean | Error> {
    try {
      const found = await this.c.env.DB.prepare(
        "SELECT 1 AS found FROM system_proposals WHERE procedure_key = ?1 LIMIT 1",
      )
        .bind(key)
        .first<number>("found")

      return found === 1
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to inspect system procedure proposals", { cause })
    }
  }

  async findMany(input: {
    category: string | null
    limit: number
    offset: number
  }): Promise<SystemProcedureList | Error> {
    try {
      const rows = await this.c.env.DB.prepare(
        `SELECT
             revision.procedure_key,
             revision.revision,
             revision.title,
             revision.category,
             revision.description,
             revision.input_schema_json,
             revision.decision_policy_json,
             revision.completion_operation_key,
             revision.created_by_account_id,
             revision.created_at
           FROM system_procedure_definitions AS definition
           JOIN system_procedure_definition_revisions AS revision
             ON revision.procedure_key = definition.key
            AND revision.revision = definition.current_revision
           WHERE definition.status = 'active'
             AND (?1 IS NULL OR revision.category = ?1)
           ORDER BY definition.key
           LIMIT ?2 OFFSET ?3`,
      )
        .bind(input.category, input.limit, input.offset)
        .all<ProcedureRow>()
      const total = await this.c.env.DB.prepare(
        `SELECT count(*) AS total
           FROM system_procedure_definitions AS definition
           JOIN system_procedure_definition_revisions AS revision
             ON revision.procedure_key = definition.key
            AND revision.revision = definition.current_revision
           WHERE definition.status = 'active'
             AND (?1 IS NULL OR revision.category = ?1)`,
      )
        .bind(input.category)
        .first<number>("total")
      const definitions: ProcedureDefinitionEntity[] = []
      for (const row of rows.results) {
        const definition = this.restore(row)
        if (definition instanceof Error) return definition
        definitions.push(definition)
      }

      return { definitions, total: total ?? 0 }
    } catch (cause) {
      return cause instanceof Error
        ? cause
        : new Error("failed to list system procedures", { cause })
    }
  }

  async publish(
    definition: ProcedureDefinitionEntity,
    expectedRevision: number,
  ): Promise<true | "revision_conflict" | Error> {
    try {
      await this.c.env.DB.batch([
        ...(this.c.publishGuards ?? []),
        ...(expectedRevision === 0
          ? this.prepareInitialPublish(definition)
          : this.prepareRevisionPublish(definition, expectedRevision)),
        ...(this.c.publishEffects ?? []),
      ])

      return true
    } catch (cause) {
      if (isAbortedByGuard(cause) || this.isConstraintConflict(cause)) {
        return "revision_conflict"
      }
      return cause instanceof Error
        ? cause
        : new Error("failed to publish system procedure", { cause })
    }
  }

  async retire(input: {
    key: ProcedureKey
    expectedRevision: number
    retiredAt: Date
  }): Promise<true | "not_found" | "revision_conflict" | Error> {
    try {
      const existing = await this.c.env.DB.prepare(
        "SELECT current_revision, status FROM system_procedure_definitions WHERE key = ?1",
      )
        .bind(input.key)
        .first<{ current_revision: number; status: "active" | "retired" }>()
      if (existing === null || existing.status === "retired") return "not_found"
      if (existing.current_revision !== input.expectedRevision) return "revision_conflict"
      await this.c.env.DB.batch([
        this.c.env.DB.prepare(
          `UPDATE system_procedure_definitions
             SET status = 'retired', updated_at = ?3
             WHERE key = ?1 AND status = 'active' AND current_revision = ?2`,
        ).bind(input.key, input.expectedRevision, input.retiredAt.getTime()),
        abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      ])

      return true
    } catch (cause) {
      if (isAbortedByGuard(cause)) return "revision_conflict"
      return cause instanceof Error
        ? cause
        : new Error("failed to retire system procedure", { cause })
    }
  }

  private prepareInitialPublish(
    definition: ProcedureDefinitionEntity,
  ): ReadonlyArray<D1PreparedStatement> {
    return [
      this.c.env.DB.prepare(
        `INSERT INTO system_procedure_definitions
             (key, current_revision, status, created_at, updated_at)
           VALUES (?1, 1, 'active', ?2, ?2)`,
      ).bind(definition.key, definition.createdAt.getTime()),
      this.c.env.DB.prepare(
        "INSERT INTO system_procedure_numbers (procedure_key) VALUES (?1)",
      ).bind(definition.key),
      this.prepareRevisionInsert(definition, false),
    ]
  }

  private prepareRevisionPublish(
    definition: ProcedureDefinitionEntity,
    expectedRevision: number,
  ): ReadonlyArray<D1PreparedStatement> {
    return [
      this.prepareRevisionInsert(definition, true, expectedRevision),
      abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
      this.c.env.DB.prepare(
        `UPDATE system_procedure_definitions
           SET current_revision = ?3, updated_at = ?4
           WHERE key = ?1 AND status = 'active' AND current_revision = ?2`,
      ).bind(definition.key, expectedRevision, definition.revision, definition.createdAt.getTime()),
      abortWhenPreviousStatementChangedNoRows(this.c.env.DB),
    ]
  }

  private prepareRevisionInsert(
    definition: ProcedureDefinitionEntity,
    conditional: boolean,
    expectedRevision = 0,
  ): D1PreparedStatement {
    const values = `?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10`
    const condition = conditional
      ? ` WHERE EXISTS (
            SELECT 1 FROM system_procedure_definitions
            WHERE key = ?1 AND status = 'active' AND current_revision = ?11
          )`
      : ""

    return this.c.env.DB.prepare(
      `INSERT INTO system_procedure_definition_revisions
           (procedure_key, revision, title, category, description, input_schema_json,
            decision_policy_json, completion_operation_key, created_by_account_id, created_at)
         SELECT ${values}${condition}`,
    ).bind(
      definition.key,
      definition.revision,
      definition.title,
      definition.category,
      definition.description,
      definition.inputSchemaJson,
      definition.decisionPolicyJson,
      definition.completionOperationKey,
      definition.createdByAccountId,
      definition.createdAt.getTime(),
      ...(conditional ? [expectedRevision] : []),
    )
  }

  private restore(row: ProcedureRow): ProcedureDefinitionEntity | Error {
    try {
      const accountId = zAccountId.safeParse(row.created_by_account_id)
      if (!accountId.success) return new InvalidSystemProposalError("invalid_shape")

      return ProcedureDefinitionEntity.create({
        key: row.procedure_key,
        revision: row.revision,
        title: row.title,
        category: row.category,
        description: row.description,
        inputSchema: JSON.parse(row.input_schema_json),
        decisionPolicy: JSON.parse(row.decision_policy_json),
        completionOperationKey: row.completion_operation_key,
        createdByAccountId: accountId.data,
        createdAt: new Date(row.created_at),
      })
    } catch (cause) {
      return new InvalidSystemProposalError("invalid_json", { cause })
    }
  }

  private isConstraintConflict(cause: unknown): boolean {
    return (
      cause instanceof Error &&
      (cause.message.includes("UNIQUE constraint failed") ||
        cause.message.includes("invalid system procedure revision"))
    )
  }
}
