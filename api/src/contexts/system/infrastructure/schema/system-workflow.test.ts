import { systemWorkflowSchema } from "@system/infrastructure/schema/system-workflow"
import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/sqlite-core"
import { readReleasedSystemMigration } from "@system/test/read-released-system-migration.test-support"
import { expectReleasedSystemSchema } from "@system/test/expect-released-system-schema.test-support"

const coreSchemaSql = readFileSync(new URL("./system-core.sql", import.meta.url), "utf8")
const workflowSchemaSql = readFileSync(new URL("./system-workflow.sql", import.meta.url), "utf8")
const decisionPolicySchemaSql = readFileSync(
  new URL("./system-decision-policy.sql", import.meta.url),
  "utf8",
)
const digest = "a".repeat(64)
const evidenceDigest = "b".repeat(64)

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec(coreSchemaSql)
  database.exec(workflowSchemaSql)
  database.exec(decisionPolicySchemaSql)

  return database
}

function insertAccount(database: Database, id: string): void {
  database.run(
    `INSERT INTO system_accounts
       (id, status, token_version, created_at, updated_at)
     VALUES (?, 'active', 0, 100, 100)`,
    [id],
  )
}

function insertCase(database: Database, id: string = "9055d4a0-416c-40c4-814b-0c6df2d0f691"): void {
  database.run(
    `INSERT INTO system_cases
       (id, subject_context, subject_kind, subject_id, subject_version,
        proposal_digest, created_by_account_id, status, created_at, updated_at)
     VALUES (?, 'request', 'change', 'resource-1', '1', ?, '3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 'pending', 100, 100)`,
    [id, digest],
  )
}

function insertTask(
  database: Database,
  props: Readonly<{
    caseId?: string
    taskKey?: string
    requiredApprovals?: number
    requiredParticipants?: number
    negativeDecisionRule?: "any-reject" | "approval-impossible"
    delegationPolicy?: "allowed" | "forbidden"
    returnPolicy?: "allowed" | "forbidden"
  }> = {},
): void {
  database.run(
    `INSERT INTO system_decision_tasks
       (case_id, task_key, round, required_approvals, required_participants,
        negative_decision_rule, delegation_policy, return_policy, proposal_digest, opened_at)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 100)`,
    [
      props.caseId ?? "9055d4a0-416c-40c4-814b-0c6df2d0f691",
      props.taskKey ?? "review",
      props.requiredApprovals ?? 1,
      props.requiredParticipants ?? props.requiredApprovals ?? 1,
      props.negativeDecisionRule ?? "any-reject",
      props.delegationPolicy ?? "allowed",
      props.returnPolicy ?? "allowed",
      digest,
    ],
  )
}

function insertCandidate(
  database: Database,
  props: Readonly<{
    accountId: string
    caseId?: string
    taskKey?: string
    source?: "primary" | "escalation"
    eligibleFrom?: number | null
  }>,
): void {
  database.run(
    `INSERT INTO system_decision_task_candidates
       (case_id, task_key, round, candidate_account_id, source,
        evidence_context, evidence_kind, evidence_id, evidence_version,
        eligibility_digest, eligible_from, resolved_at)
     VALUES (?, ?, 1, ?, ?, 'authority', 'qualification', ?, '1', ?, ?, 100)`,
    [
      props.caseId ?? "9055d4a0-416c-40c4-814b-0c6df2d0f691",
      props.taskKey ?? "review",
      props.accountId,
      props.source ?? "primary",
      `evidence-${props.accountId}`,
      evidenceDigest,
      props.eligibleFrom ?? null,
    ],
  )
}

function insertAttestation(
  database: Database,
  props: Readonly<{
    id: string
    actorAccountId: string
    representedAccountId?: string
    delegationId?: string | null
    action?: "approve" | "reject" | "return"
    decidedAt?: number
    caseId?: string
    taskKey?: string
  }>,
): void {
  database.run(
    `INSERT INTO system_human_attestations
       (id, case_id, task_key, round, actor_account_id, represented_account_id,
        delegation_id, action, proposal_digest, comment, decided_at)
     VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      props.id,
      props.caseId ?? "9055d4a0-416c-40c4-814b-0c6df2d0f691",
      props.taskKey ?? "review",
      props.actorAccountId,
      props.representedAccountId ?? props.actorAccountId,
      props.delegationId ?? null,
      props.action ?? "approve",
      digest,
      props.decidedAt ?? 110,
    ],
  )
}

describe("System workflow schema", () => {
  test("released migrationとcanonical DDLはUUIDの主キーへの作り直しだけが異なる", () => {
    expect(readReleasedSystemMigration("system_decision_policy")).toBe(decisionPolicySchemaSql)
    expectReleasedSystemSchema({
      released: [readReleasedSystemMigration("system_workflow"), decisionPolicySchemaSql],
      canonical: [workflowSchemaSql, decisionPolicySchemaSql],
      rebuiltTables: [
        "system_decision_tasks",
        "system_decision_task_candidates",
        "system_decision_task_exclusions",
      ],
    })
  })

  test("Drizzle宣言とDDLのtable・column・indexを一致させ、System外FKを持たない", () => {
    const database = createDatabase()
    const declaredTables = Object.values(systemWorkflowSchema)
      .map((table) => getTableConfig(table))
      .toSorted((left, right) => left.name.localeCompare(right.name))

    expect(declaredTables.map((table) => table.name)).toEqual([
      "system_cases",
      "system_decision_task_candidates",
      "system_decision_task_exclusions",
      "system_decision_tasks",
      "system_delegations",
      "system_execution_authorizations",
      "system_human_attestations",
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

  test("自己判断とquorum未達を拒否し、十分なappend-only証明だけで承認する", () => {
    const database = createDatabase()
    for (const accountId of [
      "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e",
      "cd94d0e3-fa4d-4f4a-9bdd-0c8920d7e370",
      "5d54bef5-3b82-48f0-b6ab-fd17d86efaae",
    ]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database, { requiredApprovals: 2 })
    database.run(
      `INSERT INTO system_decision_task_exclusions
         (case_id, task_key, round, excluded_account_id, reason)
       VALUES ('9055d4a0-416c-40c4-814b-0c6df2d0f691', 'review', 1, '3d1063a4-6a8f-4d72-af2a-90c6e9594c0e', 'creator')`,
    )

    expect(() =>
      insertCandidate(database, { accountId: "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e" }),
    ).toThrow()
    insertCandidate(database, { accountId: "cd94d0e3-fa4d-4f4a-9bdd-0c8920d7e370" })
    insertCandidate(database, { accountId: "5d54bef5-3b82-48f0-b6ab-fd17d86efaae" })
    expect(() =>
      insertAttestation(database, {
        id: "e8a2de88-6993-4b2c-8a16-f5c965fdaf9a",
        actorAccountId: "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e",
      }),
    ).toThrow()

    insertAttestation(database, {
      id: "179f4e84-128d-4195-8079-ad07689d8214",
      actorAccountId: "cd94d0e3-fa4d-4f4a-9bdd-0c8920d7e370",
    })
    expect(() =>
      database.run(
        `UPDATE system_decision_tasks
         SET outcome = 'approved', closed_at = 120
         WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'review' AND round = 1`,
      ),
    ).toThrow()
    insertAttestation(database, {
      id: "d7d7270f-1273-4385-8785-7416603f95ab",
      actorAccountId: "5d54bef5-3b82-48f0-b6ab-fd17d86efaae",
    })
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'approved', closed_at = 120
       WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'review' AND round = 1`,
    )
    database.run(
      "UPDATE system_cases SET status = 'approved', updated_at = 120 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
    )

    expect(() =>
      database.run(
        "UPDATE system_human_attestations SET comment = 'changed' WHERE id = '179f4e84-128d-4195-8079-ad07689d8214'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "DELETE FROM system_human_attestations WHERE id = '179f4e84-128d-4195-8079-ad07689d8214'",
      ),
    ).toThrow()
    expect(
      database
        .query("SELECT status FROM system_cases WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'")
        .get(),
    ).toEqual({
      status: "approved",
    })
    database.close()
  })

  test("合議体の参加定足数と否決成立条件をDB制約でも強制する", () => {
    const database = createDatabase()
    for (const accountId of [
      "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e",
      "27765443-04ad-448d-886f-508bd79e0120",
      "5002cf9e-386b-4e54-9bd4-18c982cd8ffe",
      "3526979d-29e7-4a5d-a366-4c29cec4e661",
    ]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database, {
      requiredApprovals: 2,
      requiredParticipants: 3,
      negativeDecisionRule: "approval-impossible",
    })
    for (const accountId of [
      "27765443-04ad-448d-886f-508bd79e0120",
      "5002cf9e-386b-4e54-9bd4-18c982cd8ffe",
      "3526979d-29e7-4a5d-a366-4c29cec4e661",
    ]) {
      insertCandidate(database, { accountId })
    }

    insertAttestation(database, {
      id: "f017996c-9c91-427a-8d8f-c17cd881a98d",
      actorAccountId: "27765443-04ad-448d-886f-508bd79e0120",
    })
    insertAttestation(database, {
      id: "410fdfab-e815-4702-8e92-782d7ddd57eb",
      actorAccountId: "5002cf9e-386b-4e54-9bd4-18c982cd8ffe",
    })
    expect(() =>
      database.run(
        `UPDATE system_decision_tasks
         SET outcome = 'approved', closed_at = 120
         WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'review' AND round = 1`,
      ),
    ).toThrow()
    insertAttestation(database, {
      id: "be3b3f5f-8db1-403e-8afc-5fbb589162ef",
      actorAccountId: "3526979d-29e7-4a5d-a366-4c29cec4e661",
      action: "reject",
    })
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'approved', closed_at = 120
       WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'review' AND round = 1`,
    )

    expect(
      database
        .query(
          "SELECT outcome FROM system_decision_tasks WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
        )
        .get(),
    ).toEqual({ outcome: "approved" })
    database.close()
  })

  test("Taskで禁止した代理判断と差戻しを証明の保存前に拒否する", () => {
    const database = createDatabase()
    for (const accountId of [
      "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e",
      "800004f4-f74e-455c-8f5b-7b8d0fcacb99",
      "70880624-dc0d-4666-920d-25fe6073f6d3",
    ]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database, { delegationPolicy: "forbidden", returnPolicy: "forbidden" })
    insertCandidate(database, { accountId: "800004f4-f74e-455c-8f5b-7b8d0fcacb99" })
    database.run(
      `INSERT INTO system_delegations
         (id, delegator_account_id, delegate_account_id, scope_context, scope_kind,
          scope_id, scope_version, starts_at, ends_at, created_at)
       VALUES ('60155d0b-2209-4fc6-84ce-574b18b3669d', '800004f4-f74e-455c-8f5b-7b8d0fcacb99', '70880624-dc0d-4666-920d-25fe6073f6d3', NULL, NULL, NULL, NULL, 100, 200, 100)`,
    )

    expect(() =>
      insertAttestation(database, {
        id: "79ea95b1-db7c-4cbd-85c5-71d4dd0f3962",
        actorAccountId: "70880624-dc0d-4666-920d-25fe6073f6d3",
        representedAccountId: "800004f4-f74e-455c-8f5b-7b8d0fcacb99",
        delegationId: "60155d0b-2209-4fc6-84ce-574b18b3669d",
      }),
    ).toThrow()
    expect(() =>
      insertAttestation(database, {
        id: "ff4b5b01-1013-48e9-8dcf-527f45fd5dc6",
        actorAccountId: "800004f4-f74e-455c-8f5b-7b8d0fcacb99",
        action: "return",
      }),
    ).toThrow()
    database.close()
  })

  test("時点と対象scopeが一致する委任だけを人間の判断証明として受理する", () => {
    const database = createDatabase()
    for (const accountId of [
      "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e",
      "800004f4-f74e-455c-8f5b-7b8d0fcacb99",
      "70880624-dc0d-4666-920d-25fe6073f6d3",
    ]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database)
    insertCandidate(database, { accountId: "800004f4-f74e-455c-8f5b-7b8d0fcacb99" })
    database.run(
      `INSERT INTO system_delegations
         (id, delegator_account_id, delegate_account_id, scope_context, scope_kind,
          scope_id, scope_version, starts_at, ends_at, created_at)
       VALUES
         ('fbf75845-6da4-4232-83a1-1bf2eb7bee85', '800004f4-f74e-455c-8f5b-7b8d0fcacb99', '70880624-dc0d-4666-920d-25fe6073f6d3', 'request', 'change',
          'dbcd34b4-9c95-419a-8fc3-d992cd5566d7', '1', 100, 200, 100),
         ('6478384b-2355-44fc-841b-44e5033523c0', '800004f4-f74e-455c-8f5b-7b8d0fcacb99', '70880624-dc0d-4666-920d-25fe6073f6d3', 'request', 'change',
          'resource-1', '1', 100, 200, 100)`,
    )

    expect(() =>
      insertAttestation(database, {
        id: "913d3abc-038c-41b3-8547-da800c90904d",
        actorAccountId: "70880624-dc0d-4666-920d-25fe6073f6d3",
        representedAccountId: "800004f4-f74e-455c-8f5b-7b8d0fcacb99",
        delegationId: "fbf75845-6da4-4232-83a1-1bf2eb7bee85",
      }),
    ).toThrow()
    insertAttestation(database, {
      id: "450f0cfe-4197-4a3c-8b71-6837136cb370",
      actorAccountId: "70880624-dc0d-4666-920d-25fe6073f6d3",
      representedAccountId: "800004f4-f74e-455c-8f5b-7b8d0fcacb99",
      delegationId: "6478384b-2355-44fc-841b-44e5033523c0",
    })
    expect(() =>
      database.run(
        "UPDATE system_delegations SET revoked_at = 150 WHERE id = '6478384b-2355-44fc-841b-44e5033523c0'",
      ),
    ).not.toThrow()
    expect(() =>
      database.run(
        "UPDATE system_delegations SET revoked_at = 160 WHERE id = '6478384b-2355-44fc-841b-44e5033523c0'",
      ),
    ).toThrow()
    database.close()
  })

  test("escalation開始前の判断、証拠のない差戻し、未承認実行を拒否する", () => {
    const database = createDatabase()
    for (const accountId of [
      "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e",
      "bb6754f0-9453-43d6-ad7a-7e3620497686",
      "41f77d26-5935-4a9b-ae22-309bbf0a232a",
    ]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database)
    insertCandidate(database, {
      accountId: "bb6754f0-9453-43d6-ad7a-7e3620497686",
      source: "escalation",
      eligibleFrom: 150,
    })

    expect(() =>
      insertAttestation(database, {
        id: "af839528-bb2d-482b-8a17-fcc3fe68b8a6",
        actorAccountId: "bb6754f0-9453-43d6-ad7a-7e3620497686",
        decidedAt: 149,
      }),
    ).toThrow()
    expect(() =>
      database.run(
        `UPDATE system_decision_tasks
         SET outcome = 'returned', closed_at = 150
         WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'review' AND round = 1`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_execution_authorizations
           (id, case_id, operation_key, proposal_digest, granted_to_account_id,
            granted_at, expires_at)
         VALUES ('9d6bb95e-846d-46cd-8c1c-93e17a72d6d2', '9055d4a0-416c-40c4-814b-0c6df2d0f691', 'execute', ?, '41f77d26-5935-4a9b-ae22-309bbf0a232a', 150, 200)`,
        [digest],
      ),
    ).toThrow()

    insertAttestation(database, {
      id: "b03592be-4cc7-4cfd-8152-81c8d6a94c6a",
      actorAccountId: "bb6754f0-9453-43d6-ad7a-7e3620497686",
      action: "return",
      decidedAt: 150,
    })
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'returned', closed_at = 150
       WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'review' AND round = 1`,
    )
    database.run(
      "UPDATE system_cases SET status = 'returned', updated_at = 150 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
    )
    expect(() =>
      database.run(
        "UPDATE system_cases SET status = 'approved', updated_at = 151 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
      ),
    ).toThrow()
    database.close()
  })

  test("複数Taskの否定判断ではCase全体のrejectをreturnより優先する", () => {
    const database = createDatabase()
    for (const accountId of [
      "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e",
      "25a0eac6-846e-4166-8577-7e0e7c071775",
      "bf3a7fda-132f-43eb-879b-589e4cd67ad7",
    ]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database, { taskKey: "risk-review" })
    insertTask(database, { taskKey: "content-review" })
    insertCandidate(database, {
      accountId: "25a0eac6-846e-4166-8577-7e0e7c071775",
      taskKey: "risk-review",
    })
    insertCandidate(database, {
      accountId: "bf3a7fda-132f-43eb-879b-589e4cd67ad7",
      taskKey: "content-review",
    })
    insertAttestation(database, {
      id: "f728b04b-0762-4f58-8416-0949e5d69662",
      actorAccountId: "25a0eac6-846e-4166-8577-7e0e7c071775",
      taskKey: "risk-review",
      action: "reject",
    })
    insertAttestation(database, {
      id: "ec974926-f447-4645-8f52-7d29a1787a92",
      actorAccountId: "bf3a7fda-132f-43eb-879b-589e4cd67ad7",
      taskKey: "content-review",
      action: "return",
    })
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'rejected', closed_at = 120
       WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'risk-review' AND round = 1`,
    )
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'returned', closed_at = 120
       WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'content-review' AND round = 1`,
    )

    expect(() =>
      database.run(
        "UPDATE system_cases SET status = 'returned', updated_at = 120 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
      ),
    ).toThrow()
    database.run(
      "UPDATE system_cases SET status = 'rejected', updated_at = 120 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
    )

    expect(
      database
        .query("SELECT status FROM system_cases WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'")
        .get(),
    ).toEqual({
      status: "rejected",
    })
    database.close()
  })

  test("取消時にopen taskを残さず、再割当roundを取消済みroundの次だけに限定する", () => {
    const database = createDatabase()
    insertAccount(database, "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e")
    insertCase(database)
    insertTask(database)

    expect(() =>
      database.run(
        "UPDATE system_cases SET status = 'cancelled', updated_at = 110 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_decision_tasks
           (case_id, task_key, round, required_approvals, required_participants,
            negative_decision_rule, proposal_digest, opened_at)
         VALUES ('9055d4a0-416c-40c4-814b-0c6df2d0f691', 'review', 2, 1, 1, 'any-reject', ?, 110)`,
        [digest],
      ),
    ).toThrow()

    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'cancelled', closed_at = 110
       WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'review' AND round = 1`,
    )
    database.run(
      `INSERT INTO system_decision_tasks
         (case_id, task_key, round, required_approvals, required_participants,
          negative_decision_rule, proposal_digest, opened_at)
       VALUES ('9055d4a0-416c-40c4-814b-0c6df2d0f691', 'review', 2, 1, 1, 'any-reject', ?, 110)`,
      [digest],
    )
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'cancelled', closed_at = 120
       WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'review' AND round = 2`,
    )
    database.run(
      "UPDATE system_cases SET status = 'cancelled', updated_at = 120 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
    )

    expect(
      database
        .query("SELECT status FROM system_cases WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'")
        .get(),
    ).toEqual({
      status: "cancelled",
    })
    database.close()
  })

  test("承認digestへ発行した実行許可を期限内に一度だけ消費して実行済みにする", () => {
    const database = createDatabase()
    for (const accountId of [
      "3d1063a4-6a8f-4d72-af2a-90c6e9594c0e",
      "bb6754f0-9453-43d6-ad7a-7e3620497686",
      "41f77d26-5935-4a9b-ae22-309bbf0a232a",
    ]) {
      insertAccount(database, accountId)
    }
    insertCase(database)
    insertTask(database)
    insertCandidate(database, { accountId: "bb6754f0-9453-43d6-ad7a-7e3620497686" })
    insertAttestation(database, {
      id: "065b73d6-94bb-424f-8c91-d5e7b2289ec3",
      actorAccountId: "bb6754f0-9453-43d6-ad7a-7e3620497686",
    })
    database.run(
      `UPDATE system_decision_tasks
       SET outcome = 'approved', closed_at = 120
       WHERE case_id = '9055d4a0-416c-40c4-814b-0c6df2d0f691' AND task_key = 'review' AND round = 1`,
    )
    database.run(
      "UPDATE system_cases SET status = 'approved', updated_at = 120 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
    )
    database.run(
      `INSERT INTO system_execution_authorizations
         (id, case_id, operation_key, proposal_digest, granted_to_account_id,
          granted_at, expires_at)
       VALUES ('9d6bb95e-846d-46cd-8c1c-93e17a72d6d2', '9055d4a0-416c-40c4-814b-0c6df2d0f691', 'execute', ?, '41f77d26-5935-4a9b-ae22-309bbf0a232a', 120, 200)`,
      [digest],
    )

    expect(() =>
      database.run(
        "UPDATE system_execution_authorizations SET used_at = 200 WHERE id = '9d6bb95e-846d-46cd-8c1c-93e17a72d6d2'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "UPDATE system_cases SET status = 'executed', updated_at = 130 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
      ),
    ).toThrow()
    database.run(
      "UPDATE system_execution_authorizations SET used_at = 130 WHERE id = '9d6bb95e-846d-46cd-8c1c-93e17a72d6d2'",
    )
    expect(() =>
      database.run(
        "UPDATE system_execution_authorizations SET used_at = 140 WHERE id = '9d6bb95e-846d-46cd-8c1c-93e17a72d6d2'",
      ),
    ).toThrow()
    database.run(
      "UPDATE system_cases SET status = 'executed', updated_at = 130 WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'",
    )

    expect(
      database
        .query("SELECT status FROM system_cases WHERE id = '9055d4a0-416c-40c4-814b-0c6df2d0f691'")
        .get(),
    ).toEqual({
      status: "executed",
    })
    database.close()
  })
})
