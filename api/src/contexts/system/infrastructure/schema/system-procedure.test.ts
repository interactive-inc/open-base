import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { systemProcedureSchema } from "@system/infrastructure/schema/system-procedure"
import { readReleasedSystemMigration } from "@system/test/read-released-system-migration.test-support"
import { expectReleasedSystemSchema } from "@system/test/expect-released-system-schema.test-support"

const coreSchemaSql = readFileSync(new URL("./system-core.sql", import.meta.url), "utf8")
const workflowSchemaSql = readFileSync(new URL("./system-workflow.sql", import.meta.url), "utf8")
const decisionPolicySchemaSql = readFileSync(
  new URL("./system-decision-policy.sql", import.meta.url),
  "utf8",
)
const procedureSchemaSql = readFileSync(new URL("./system-procedure.sql", import.meta.url), "utf8")
const digest = "a".repeat(64)

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec(coreSchemaSql)
  database.exec(workflowSchemaSql)
  database.exec(decisionPolicySchemaSql)
  database.exec(procedureSchemaSql)
  database.run(
    `INSERT INTO system_accounts
       (id, status, token_version, created_at, updated_at)
     VALUES ('3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 'active', 0, 100, 100)`,
  )

  return database
}

function insertDefinition(database: Database): void {
  database.run(
    `INSERT INTO system_procedure_definitions
       (key, current_revision, status, created_at, updated_at)
     VALUES ('change', 1, 'active', 100, 100)`,
  )
  database.run(
    `INSERT INTO system_procedure_definition_revisions
       (procedure_key, revision, title, category, input_schema_json,
        decision_policy_json, created_by_account_id, created_at)
     VALUES ('change', 1, 'Change', 'operation', '{}', '{"steps":[]}', '3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 100)`,
  )
}

function insertProposal(database: Database): void {
  database.run(
    `INSERT INTO system_proposal_series
       (id, procedure_key, created_by_account_id, created_at)
     VALUES ('27ea4b6a-6e22-49b1-8303-ea9e8c5416a9', 'change', '3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 100)`,
  )
  database.run(
    `INSERT INTO system_proposals
       (id, series_id, version, procedure_key, procedure_revision, body_json,
        digest, created_by_account_id, created_at)
     VALUES ('e42be528-73db-4ad0-86f3-1083e6a413f2', '27ea4b6a-6e22-49b1-8303-ea9e8c5416a9', 1, 'change', 1, '{"reason":"safe"}', ?, '3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 100)`,
    [digest],
  )
}

describe("System procedure schema", () => {
  test("released migrationとcanonical DDLはUUIDの主キーへの作り直しだけが異なる", () => {
    expectReleasedSystemSchema({
      released: [
        readReleasedSystemMigration("system_procedure"),
        readReleasedSystemMigration("allow_system_record_preservation_proposals"),
      ],
      canonical: [procedureSchemaSql],
      rebuiltTables: ["system_procedure_definitions", "system_procedure_definition_revisions"],
    })
  })

  test("Drizzle宣言とDDLのtable・column・indexを一致させ、System外FKを持たない", () => {
    const database = createDatabase()
    const declaredTables = Object.values(systemProcedureSchema)
      .map((table) => getTableConfig(table))
      .toSorted((left, right) => left.name.localeCompare(right.name))

    expect(declaredTables.map((table) => table.name)).toEqual([
      "system_procedure_definition_revisions",
      "system_procedure_definitions",
      "system_procedure_numbers",
      "system_proposal_cases",
      "system_proposal_numbers",
      "system_proposal_series",
      "system_proposals",
    ])

    const liveIndexes = new Set(
      database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
        )
        .all()
        .map((index) => index.name),
    )

    for (const table of declaredTables) {
      const columns = database
        .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
        .all()
        .map((column) => column.name)
      const foreignTables = database
        .query<{ table: string }, []>(`PRAGMA foreign_key_list(${table.name})`)
        .all()
        .map((foreignKey) => foreignKey.table)

      expect(columns).toEqual(table.columns.map((column) => column.name))
      expect(foreignTables.every((foreignTable) => foreignTable.startsWith("system_"))).toBe(true)
      expect(
        table.indexes
          .map((index) => index.config.name)
          .filter((name): name is string => typeof name === "string" && !liveIndexes.has(name)),
      ).toEqual([])
    }

    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
    database.close()
  })

  test("手続版を追記専用にし、現在版を一段ずつ進める", () => {
    const database = createDatabase()
    insertDefinition(database)

    expect(() =>
      database.run(
        "UPDATE system_procedure_definition_revisions SET title = 'Changed' WHERE procedure_key = 'change'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "UPDATE system_procedure_definitions SET current_revision = 2, updated_at = 110 WHERE key = 'change'",
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_procedure_definition_revisions
         (procedure_key, revision, title, category, input_schema_json,
          decision_policy_json, created_by_account_id, created_at)
       VALUES ('change', 2, 'Change v2', 'operation', '{}', '{}', '3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 110)`,
    )
    database.run(
      "UPDATE system_procedure_definitions SET current_revision = 2, updated_at = 110 WHERE key = 'change'",
    )
    expect(() =>
      database.run(
        "UPDATE system_procedure_definitions SET current_revision = 4, updated_at = 120 WHERE key = 'change'",
      ),
    ).toThrow()

    expect(
      database.query("SELECT current_revision FROM system_procedure_definitions").get(),
    ).toEqual({ current_revision: 2 })
    database.close()
  })

  test("提案のlineageとCaseのversion・digest・作成者を変更不能に固定する", () => {
    const database = createDatabase()
    insertDefinition(database)
    insertProposal(database)
    database.run(
      `INSERT INTO system_cases
         (id, subject_context, subject_kind, subject_id, subject_version,
          proposal_digest, created_by_account_id, status, created_at, updated_at)
       VALUES ('9055d4a0-416c-40c4-814b-0c6df2d0f691', 'system', 'proposal', '27ea4b6a-6e22-49b1-8303-ea9e8c5416a9', '1', ?, '3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 'pending', 100, 100)`,
      [digest],
    )
    database.run(
      "INSERT INTO system_proposal_cases (proposal_id, case_id, linked_at) VALUES ('e42be528-73db-4ad0-86f3-1083e6a413f2', '9055d4a0-416c-40c4-814b-0c6df2d0f691', 100)",
    )

    expect(() =>
      database.run(
        "UPDATE system_proposals SET body_json = '{}' WHERE id = 'e42be528-73db-4ad0-86f3-1083e6a413f2'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_proposals
           (id, series_id, version, procedure_key, procedure_revision, body_json,
            digest, created_by_account_id, supersedes_proposal_id, created_at)
         VALUES ('5507637c-810c-4cf0-865f-2c2433bf6b06', '27ea4b6a-6e22-49b1-8303-ea9e8c5416a9', 3, 'change', 1, '{}', ?, '3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 'e42be528-73db-4ad0-86f3-1083e6a413f2', 120)`,
        [digest],
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "UPDATE system_proposal_cases SET linked_at = 101 WHERE proposal_id = 'e42be528-73db-4ad0-86f3-1083e6a413f2'",
      ),
    ).toThrow()

    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
    database.close()
  })

  test("Caseとの不一致を部分的に受理しない", () => {
    const database = createDatabase()
    insertDefinition(database)
    insertProposal(database)
    database.run(
      `INSERT INTO system_cases
         (id, subject_context, subject_kind, subject_id, subject_version,
          proposal_digest, created_by_account_id, status, created_at, updated_at)
       VALUES ('9055d4a0-416c-40c4-814b-0c6df2d0f691', 'system', 'proposal', 'wrong-series', '1', ?, '3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 'pending', 100, 100)`,
      [digest],
    )

    expect(() =>
      database.run(
        "INSERT INTO system_proposal_cases (proposal_id, case_id, linked_at) VALUES ('e42be528-73db-4ad0-86f3-1083e6a413f2', '9055d4a0-416c-40c4-814b-0c6df2d0f691', 100)",
      ),
    ).toThrow()
    database.close()
  })
})

test("record preservation Case requires the exact operation, subject and body version", () => {
  for (const scenario of ["allowed", "operation", "record", "version", "missing", "kind"]) {
    const database = createDatabase()
    try {
      insertDefinition(database)
      database.run(
        "INSERT INTO system_proposal_series(id,procedure_key,created_by_account_id,created_at) VALUES ('27ea4b6a-6e22-49b1-8303-ea9e8c5416a9','change','3d1063a4-6a8f-4d72-af2a-90c6e9594c0e',100)",
      )
      const body =
        scenario === "missing"
          ? {}
          : {
              operation: scenario === "operation" ? "other" : "system.record.preserve",
              version: scenario === "version" ? 2 : 1,
              recordId: scenario === "record" ? "other" : "record-1",
            }
      database.run(
        `INSERT INTO system_proposals(id,series_id,version,procedure_key,procedure_revision,body_json,digest,created_by_account_id,created_at) VALUES ('e42be528-73db-4ad0-86f3-1083e6a413f2','27ea4b6a-6e22-49b1-8303-ea9e8c5416a9',1,'change',1,?1,?2,'3d1063a4-6a8f-4d72-af2a-90c6e9594c0e',100)`,
        [JSON.stringify(body), digest],
      )
      database.run(
        `INSERT INTO system_cases(id,subject_context,subject_kind,subject_id,subject_version,proposal_digest,created_by_account_id,status,created_at,updated_at) VALUES ('9055d4a0-416c-40c4-814b-0c6df2d0f691','system',?1,'record-1','1',?2,'3d1063a4-6a8f-4d72-af2a-90c6e9594c0e','pending',100,100)`,
        [scenario === "kind" ? "other" : "record-preservation", digest],
      )
      const link = () =>
        database.run(
          "INSERT INTO system_proposal_cases(proposal_id,case_id,linked_at) VALUES ('e42be528-73db-4ad0-86f3-1083e6a413f2','9055d4a0-416c-40c4-814b-0c6df2d0f691',100)",
        )
      if (scenario === "allowed") expect(link).not.toThrow()
      else expect(link).toThrow()
    } finally {
      database.close()
    }
  }
})
