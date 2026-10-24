import { systemCoreSchema } from "@/contexts/system/infrastructure/schema/system-core"
import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/sqlite-core"

const schemaSql = readFileSync(new URL("./system-core.sql", import.meta.url), "utf8")

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec(schemaSql)
  return database
}

function insertAccount(
  database: Database,
  id: string = "d5858208-e680-4db8-a05d-8bf4f900c24e",
): void {
  database.run(
    `INSERT INTO system_accounts
       (id, status, token_version, created_at, updated_at)
     VALUES (?, 'active', 0, 100, 100)`,
    [id],
  )
}

function insertRole(database: Database): void {
  database.run(
    `INSERT INTO system_iam_roles
       (id, key, kind, name, created_at, updated_at)
     VALUES ('92ab97b6-273c-42c6-8b7e-895d366202c0', 'system:admin', 'managed', 'System root', 100, 100)`,
  )
}

describe("canonical System core schema", () => {
  test("D1 remote parserがcommentを空statementに分割しない", () => {
    const comments = schemaSql.match(/\/\*[\s\S]*?\*\/|--[^\n]*/g) ?? []
    const triggerMarkers = comments.filter((comment) =>
      comment.includes("DDL-only test harnesses skip compound triggers"),
    )

    expect(triggerMarkers).toHaveLength(20)
    expect(comments.filter((comment) => comment.includes(";"))).toEqual([])
  })

  test("既存tableとdataを変更せず、空のSystem tableだけを追加する", () => {
    const database = new Database(":memory:")
    database.exec("PRAGMA foreign_keys = ON")
    database.exec(`
      CREATE TABLE existing_sentinel (
        id TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      INSERT INTO existing_sentinel (id, value) VALUES ('existing', 'preserved');
    `)

    database.exec(schemaSql)

    expect(database.query("SELECT id, value FROM existing_sentinel").all()).toEqual([
      { id: "existing", value: "preserved" },
    ])

    for (const table of Object.values(systemCoreSchema).map((entry) => getTableConfig(entry))) {
      expect(
        database.query<{ count: number }, []>(`SELECT count(*) AS count FROM ${table.name}`).get(),
      ).toEqual({ count: 0 })
    }

    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
    database.close()
  })

  test("Drizzle declarationとcanonical DDLのtable・columnを一致させ、System外FKを持たない", () => {
    const database = createDatabase()
    const declaredTables = Object.values(systemCoreSchema)
      .map((table) => getTableConfig(table))
      .sort((left, right) => left.name.localeCompare(right.name))

    expect(declaredTables.map(({ name }) => name)).toEqual([
      "system_account_invitations",
      "system_accounts",
      "system_audit_disclosure_policy_revisions",
      "system_audit_events",
      "system_authentication_attempts",
      "system_batch_jobs",
      "system_bootstrap_state",
      "system_browser_login_codes",
      "system_cli_login_codes",
      "system_cli_login_states",
      "system_iam_role_permissions",
      "system_iam_roles",
      "system_identity_bindings",
      "system_identity_login_tokens",
      "system_identity_profiles",
      "system_notification_deliveries",
      "system_notification_messages",
      "system_notification_resource_scopes",
      "system_oidc_access_tokens",
      "system_oidc_authorization_codes",
      "system_password_credentials",
      "system_password_reset_challenges",
      "system_role_bindings",
      "system_sessions",
    ])

    for (const table of declaredTables) {
      const databaseColumns = database
        .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
        .all()
        .map((column) => column.name)
      const foreignTables = database
        .query<{ table: string }, []>(`PRAGMA foreign_key_list(${table.name})`)
        .all()
        .map((foreignKey) => foreignKey.table)

      // UUID 化の migration が一部の column を末尾へ付け直したため、並びではなく集合で照合する。
      expect([...databaseColumns].sort()).toEqual(table.columns.map((column) => column.name).sort())
      expect(foreignTables.every((foreignTable) => foreignTable.startsWith("system_"))).toBe(true)
    }

    const liveIndexes = new Set(
      database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'",
        )
        .all()
        .map((index) => index.name),
    )
    const missingIndexes = declaredTables.flatMap((table) =>
      table.indexes
        .map((index) => index.config.name)
        .filter((name): name is string => typeof name === "string" && !liveIndexes.has(name))
        .map((name) => `${table.name}.${name}`),
    )

    expect(missingIndexes).toEqual([])

    const passwordColumns = database
      .query<{ name: string }, []>("PRAGMA table_info(system_password_credentials)")
      .all()
      .map((column) => column.name)
    const sessionColumns = database
      .query<{ name: string }, []>("PRAGMA table_info(system_sessions)")
      .all()
      .map((column) => column.name)

    expect(passwordColumns).toContain("password_hash")
    expect(passwordColumns).not.toContain("password")
    expect(sessionColumns).toContain("token_hash")
    expect(sessionColumns).not.toContain("token")
    database.close()
  })

  test("AccountEntity・Identity・credential・Sessionの型、一意性、時系列をfail closedにする", () => {
    const database = createDatabase()

    expect(() =>
      database.run(
        `INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES ('434d2b37-4b7e-400c-82d8-10451c11f513', 'disabled', 0, 100, 100)`,
      ),
    ).toThrow()
    insertAccount(database)
    expect(() =>
      database.run(
        "UPDATE system_accounts SET status = 'locked', updated_at = 101 WHERE id = 'd5858208-e680-4db8-a05d-8bf4f900c24e'",
      ),
    ).toThrow()
    database.run(
      `UPDATE system_accounts
       SET status = 'locked', token_version = 1, updated_at = 101
       WHERE id = 'd5858208-e680-4db8-a05d-8bf4f900c24e'`,
    )
    expect(() =>
      database.run(
        "UPDATE system_accounts SET token_version = 0, updated_at = 102 WHERE id = 'd5858208-e680-4db8-a05d-8bf4f900c24e'",
      ),
    ).toThrow()

    database.run(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at)
       VALUES ('166ce80b-9a6c-4cdc-b3ad-c4cfb962de1f', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'password', 'User@Example.test', 100, 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at)
         VALUES ('b3460b5f-1fe4-477a-b6fd-c16052906424', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'password', 'User@Example.test', 100, 100)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at)
       VALUES ('67150a57-caa3-49c8-90f0-df6f7a384a07', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'google', 'subject-1', 100, 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_password_credentials
           (identity_id, password_hash, changed_at, created_at, updated_at)
         VALUES ('67150a57-caa3-49c8-90f0-df6f7a384a07', ?, 100, 100, 100)`,
        ["h".repeat(64)],
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_password_credentials
         (identity_id, password_hash, changed_at, created_at, updated_at)
       VALUES ('166ce80b-9a6c-4cdc-b3ad-c4cfb962de1f', ?, 100, 100, 100)`,
      ["h".repeat(64)],
    )
    expect(() =>
      database.run(
        `UPDATE system_password_credentials
         SET changed_at = 99, updated_at = 101
         WHERE identity_id = '166ce80b-9a6c-4cdc-b3ad-c4cfb962de1f'`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `UPDATE system_identity_bindings
         SET activated_at = 101
         WHERE id = '166ce80b-9a6c-4cdc-b3ad-c4cfb962de1f'`,
      ),
    ).toThrow()

    expect(() =>
      database.run(
        `INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version, created_at, expires_at)
         VALUES ('cd2a6c1c-867a-4626-98c7-12a10baa156f', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'family-1', ?, 0, 100, 100)`,
        ["a".repeat(64)],
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_sessions
         (id, account_id, family_id, token_hash, token_version, created_at, expires_at)
       VALUES ('525b9676-68a4-4575-8f18-694f41810014', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'family-1', ?, 0, 100, 200)`,
      ["a".repeat(64)],
    )
    database.run(
      "UPDATE system_sessions SET rotated_at = 150 WHERE id = '525b9676-68a4-4575-8f18-694f41810014'",
    )
    expect(() =>
      database.run(
        "UPDATE system_sessions SET rotated_at = 160 WHERE id = '525b9676-68a4-4575-8f18-694f41810014'",
      ),
    ).toThrow()
    database.run(
      "UPDATE system_sessions SET revoked_at = 170 WHERE id = '525b9676-68a4-4575-8f18-694f41810014'",
    )
    expect(() =>
      database.run(
        "UPDATE system_sessions SET revoked_at = 180 WHERE id = '525b9676-68a4-4575-8f18-694f41810014'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_sessions
           (id, account_id, family_id, token_hash, token_version, created_at, expires_at)
         VALUES ('261c5041-b688-4a45-92af-92ea330c73dc', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'family-1', ?, 0, 100, 200)`,
        ["a".repeat(64)],
      ),
    ).toThrow()

    database.close()
  })

  test("IAM resource pair・active binding一意性・System-only bootstrapをDBで守る", () => {
    const database = createDatabase()
    insertAccount(database)
    insertRole(database)
    database.run(
      `INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at)
       VALUES ('8d9a49af-964f-426a-88d1-d3de8279d573', 'd5858208-e680-4db8-a05d-8bf4f900c24e', '92ab97b6-273c-42c6-8b7e-895d366202c0', NULL, NULL, 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_bootstrap_state
           (singleton, completed_by_account_id, root_binding_id, completed_at)
         VALUES (1, 'd5858208-e680-4db8-a05d-8bf4f900c24e', '8d9a49af-964f-426a-88d1-d3de8279d573', 100)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_iam_role_permissions (role_id, permission_key)
       VALUES ('92ab97b6-273c-42c6-8b7e-895d366202c0', 'system:admin')`,
    )

    expect(() =>
      database.run(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at)
         VALUES ('afc3f7d5-b1e6-45b0-8986-c40d535bc11a', 'd5858208-e680-4db8-a05d-8bf4f900c24e', '92ab97b6-273c-42c6-8b7e-895d366202c0', NULL, NULL, 101)`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at)
         VALUES ('d781afbf-83b1-41ba-8f9e-686711a87ec9', 'd5858208-e680-4db8-a05d-8bf4f900c24e', '92ab97b6-273c-42c6-8b7e-895d366202c0', 'facility:read', NULL, 100)`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_bootstrap_state
           (singleton, completed_by_account_id, root_binding_id, completed_at)
         VALUES (2, 'd5858208-e680-4db8-a05d-8bf4f900c24e', '8d9a49af-964f-426a-88d1-d3de8279d573', 100)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_bootstrap_state
         (singleton, completed_by_account_id, root_binding_id, completed_at)
       VALUES (1, 'd5858208-e680-4db8-a05d-8bf4f900c24e', '8d9a49af-964f-426a-88d1-d3de8279d573', 100)`,
    )

    expect(
      database.query("SELECT completed_by_account_id FROM system_bootstrap_state").get(),
    ).toEqual({ completed_by_account_id: "d5858208-e680-4db8-a05d-8bf4f900c24e" })
    expect(() =>
      database.run("UPDATE system_bootstrap_state SET completed_at = 101 WHERE singleton = 1"),
    ).toThrow()
    expect(() => database.run("DELETE FROM system_bootstrap_state WHERE singleton = 1")).toThrow()
    expect(() =>
      database.run(
        "UPDATE system_role_bindings SET created_at = 101 WHERE id = '8d9a49af-964f-426a-88d1-d3de8279d573'",
      ),
    ).toThrow()
    database.run(
      "UPDATE system_role_bindings SET revoked_at = 110 WHERE id = '8d9a49af-964f-426a-88d1-d3de8279d573'",
    )
    expect(() =>
      database.run(
        "UPDATE system_role_bindings SET revoked_at = 120 WHERE id = '8d9a49af-964f-426a-88d1-d3de8279d573'",
      ),
    ).toThrow()
    database.close()
  })

  test("Notification messageをimmutableにし、AccountEntity delivery/readを一意かつ単調にする", () => {
    const database = createDatabase()
    insertAccount(database)

    expect(() =>
      database.run(
        `INSERT INTO system_notification_messages
           (id, kind, title, source_type, source_id, created_at)
         VALUES ('bad-message', 'system:test', 'Bad', 'example:event', NULL, 100)`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_notification_messages
           (id, kind, title, action_type, created_at)
         VALUES ('bad-action', 'system:test', 'Bad', 'example:action', 100)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_notification_messages
         (id, kind, title, body, source_type, source_id, action_type, action_id, created_at)
       VALUES ('message-1', 'system:test', 'Title', 'Body', 'example:event', 'event-1',
               'example:action', 'target-1', 100)`,
    )
    expect(() =>
      database.run(
        "UPDATE system_notification_messages SET title = 'Changed' WHERE id = 'message-1'",
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_notification_resource_scopes
         (message_id, resource_type, resource_id)
       VALUES ('message-1', 'example:resource', 'resource-1')`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_notification_resource_scopes
           (message_id, resource_type, resource_id)
         VALUES ('message-1', 'example:other', 'resource-2')`,
      ),
    ).toThrow()
    expect(() =>
      database.run(
        `INSERT INTO system_notification_resource_scopes
           (message_id, resource_type, resource_id)
         VALUES ('missing', 'example:resource', 'resource-1')`,
      ),
    ).toThrow()

    expect(() =>
      database.run(
        `INSERT INTO system_notification_deliveries
           (id, message_id, recipient_account_id, delivered_at, read_at)
         VALUES ('delivery-bad', 'message-1', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 100, 99)`,
      ),
    ).toThrow()
    database.run(
      `INSERT INTO system_notification_deliveries
         (id, message_id, recipient_account_id, delivered_at)
       VALUES ('delivery-1', 'message-1', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_notification_deliveries
           (id, message_id, recipient_account_id, delivered_at)
         VALUES ('delivery-duplicate', 'message-1', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 101)`,
      ),
    ).toThrow()
    database.run("UPDATE system_notification_deliveries SET read_at = 110 WHERE id = 'delivery-1'")
    expect(() =>
      database.run(
        "UPDATE system_notification_deliveries SET read_at = 120 WHERE id = 'delivery-1'",
      ),
    ).toThrow()

    database.close()
  })

  test("audit actorをAccountEntity FKから切り離し、eventをappend-onlyにする", () => {
    const database = createDatabase()
    database.run(
      `INSERT INTO system_audit_events
         (event_id, actor_account_id, action, target_type, target_id, outcome, occurred_at)
       VALUES ('0190aaaa-0000-4000-8000-000000000001', '0d5bac1a-9f1d-45cd-af40-61607b0a9b9f', 'system.account.locked', 'system:account',
               'd5858208-e680-4db8-a05d-8bf4f900c24e', 'succeeded', 100)`,
    )
    expect(() =>
      database.run(
        `INSERT INTO system_audit_events
           (event_id, action, target_type, outcome, metadata_json, occurred_at)
         VALUES ('0190aaaa-0000-4000-8000-000000000002', 'system.account.locked', 'system:account',
                 'failed', '{', 101)`,
      ),
    ).toThrow()

    expect(() =>
      database.run(
        "UPDATE system_audit_events SET outcome = 'failed' WHERE event_id = '0190aaaa-0000-4000-8000-000000000001'",
      ),
    ).toThrow()
    expect(() =>
      database.run(
        "DELETE FROM system_audit_events WHERE event_id = '0190aaaa-0000-4000-8000-000000000001'",
      ),
    ).toThrow()

    expect(database.query("SELECT actor_account_id FROM system_audit_events").get()).toEqual({
      actor_account_id: "0d5bac1a-9f1d-45cd-af40-61607b0a9b9f",
    })
    database.close()
  })
})
