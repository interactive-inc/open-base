import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { readMigrationFiles } from "drizzle-orm/migrator"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { testAccountId } from "@system/test/system-test-id.test-support"
import { PublishSystemAuditDisclosurePolicy } from "@system/application/audit/publish-system-audit-disclosure-policy"
import { SystemAuditDisclosurePolicyEntity } from "@system/domain/entities/system-audit-disclosure-policy.entity"
import { SystemAuditDisclosurePolicyRepository } from "@system/infrastructure/repositories/audit/system-audit-disclosure-policy.repository"

const schemaDirectory = new URL("../../../contexts/system/infrastructure/schema/", import.meta.url)
const migrationSql = readFileSync(
  new URL("../../../db/migrations/0017_audit_disclosure_legacy_retirement.sql", import.meta.url),
  "utf8",
)
const oldSql = readFileSync(
  new URL("../../../db/migrations/0001_foundation.sql", import.meta.url),
  "utf8",
)
const policyGuard = "CREATE TRIGGER system_audit_disclosure_revision_insert"
const accountGuard = "CREATE TRIGGER system_accounts_legacy_id_insert"
const oldGuard = requiredGuard(splitSqlStatements(oldSql), policyGuard)
const core = splitSqlStatements(readFileSync(new URL("system-core.sql", schemaDirectory), "utf8"))
const immutableAccount = requiredGuard(core, accountGuard)

function requiredGuard(statements: ReadonlyArray<string>, marker: string): string {
  const statement = statements.find((value) => value.includes(marker))
  if (statement === undefined) throw new Error("migration guard missing")
  return statement
}
const terminated = (statement: string) =>
  statement.trim().endsWith(";") ? statement : `${statement};`
const beforeCore = core.filter(
  (statement) => !statement.includes(policyGuard) && !statement.includes(accountGuard),
)
const schema =
  beforeCore.map(terminated).join("\n") +
  "\n" +
  [
    "system-integration.sql",
    "system-principal.sql",
    "system-attachment.sql",
    "system-workflow.sql",
    "system-procedure.sql",
  ]
    .map((name) => readFileSync(new URL(name, schemaDirectory), "utf8"))
    .join("\n")
const actor = testAccountId("migration-admin")
const reader = testAccountId("migration-reader")
const now = new Date("2026-02-01T00:00:00.000Z")

/** 識別子の移行と同じく、保存済みの行を投入してから旧い不変条件を設置する。 */
async function fixture() {
  const database = await createLocalD1Database({ schema })
  await database.batch([
    database
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 1, 1)",
      )
      .bind(actor),
    database
      .prepare(
        "INSERT INTO system_accounts (id, legacy_id, status, token_version, created_at, updated_at) VALUES (?1, 'legacy-reader', 'active', 0, 1, 1)",
      )
      .bind(reader),
  ])
  const old = SystemAuditDisclosurePolicyEntity.restore({
    scope: "legacy-reader",
    commandId: crypto.randomUUID(),
    revision: 1,
    enabled: true,
    allowedFields: [],
    allowedTargetTypes: null,
    allowedPurposes: ["review"],
    expiresAt: null,
    reason: "保存済みの制限",
    actorAccountId: actor,
    recordedAt: "2026-01-01T00:00:00.000Z",
    auditEventId: crypto.randomUUID(),
  })
  if (old instanceof Error) throw old
  const event = old.audit(null)
  if (event instanceof Error) throw event
  await database.batch([
    database
      .prepare(`INSERT INTO system_audit_events
      (event_id, actor_account_id, action, target_type, target_id, outcome, authorization_json, after_json, occurred_at)
      VALUES (?1, ?2, ?3, ?4, ?5, 'succeeded', ?6, ?7, ?8)`)
      .bind(
        event.eventId,
        actor,
        event.action,
        event.targetType,
        event.targetId,
        event.authorizationJson,
        event.afterJson,
        event.occurredAtEpochMilliseconds,
      ),
    database
      .prepare(`INSERT INTO system_audit_disclosure_policy_revisions
      (id, scope, revision, command_id, enabled, allowed_fields_json, allowed_purposes_json, reason, actor_account_id, recorded_at, audit_event_id)
      VALUES (?1, 'legacy-reader', 1, ?2, 1, '[]', '["review"]', ?3, ?4, ?5, ?6)`)
      .bind(
        crypto.randomUUID(),
        old.snapshot.commandId,
        old.snapshot.reason,
        actor,
        Date.parse(old.snapshot.recordedAt),
        event.eventId,
      ),
  ])
  await execSql(database, `${terminated(immutableAccount)}\n${terminated(oldGuard)}`)
  const application = new PublishSystemAuditDisclosurePolicy({
    repository: new SystemAuditDisclosurePolicyRepository({
      env: { DB: database },
      assertions: [],
    }),
  })
  const command = {
    scope: reader,
    commandId: crypto.randomUUID(),
    expectedRevision: 0,
    supersedesLegacyRevision: 1,
    enabled: true,
    allowedFields: [],
    allowedTargetTypes: null,
    allowedPurposes: ["review"],
    expiresAt: null,
    reason: "新しい番号へ引き継ぐ",
    actorAccountId: actor,
  }
  return { database, application, command }
}

async function snapshot(database: D1Database) {
  return {
    accounts: (await database.prepare("SELECT * FROM system_accounts ORDER BY id").all()).results,
    policies: (
      await database
        .prepare("SELECT * FROM system_audit_disclosure_policy_revisions ORDER BY scope, revision")
        .all()
    ).results,
    audits: (await database.prepare("SELECT * FROM system_audit_events ORDER BY event_id").all())
      .results,
  }
}

test("前進移行は保存済みの行を変えず、旧版の解除と新設定の一括追記を可能にする", async () => {
  const f = await fixture()
  const before = await snapshot(f.database)
  expect(await f.application.execute(f.command, now)).toMatchObject({ kind: "conflict" })
  expect(await snapshot(f.database)).toEqual(before)
  const migration = readMigrationFiles({
    migrationsFolder: new URL("../../../db/migrations/", import.meta.url).pathname,
  }).find((entry) => entry.hash === createHash("sha256").update(migrationSql).digest("hex"))
  if (migration === undefined) throw new Error("migration missing")
  await f.database.batch(migration.sql.map((statement) => f.database.prepare(statement)))
  expect(await snapshot(f.database)).toEqual(before)
  const result = await f.application.execute(f.command, now)
  if (result instanceof Error) throw result
  expect(result.replayed).toBe(false)
  expect(
    (
      await f.database
        .prepare(
          "SELECT scope, revision, enabled FROM system_audit_disclosure_policy_revisions ORDER BY scope, revision",
        )
        .all()
    ).results,
  ).toEqual(
    [
      { scope: reader, revision: 1, enabled: 1 },
      { scope: "legacy-reader", revision: 1, enabled: 1 },
      { scope: "legacy-reader", revision: 2, enabled: 0 },
    ].sort((a, b) => a.scope.localeCompare(b.scope) || a.revision - b.revision),
  )
  expect((await f.database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
}, 30_000)

test("移行の後段が失敗した場合は旧い制約と原本を保つ", async () => {
  const f = await fixture()
  const before = await snapshot(f.database)
  const guard = await f.database
    .prepare("SELECT sql FROM sqlite_master WHERE name = 'system_audit_disclosure_revision_insert'")
    .first<string>("sql")
  await expect(
    execSql(f.database, migrationSql + "\nSELECT json_extract('{}', 'injected_late_failure');"),
  ).rejects.toThrow()
  expect(await snapshot(f.database)).toEqual(before)
  expect(
    await f.database
      .prepare(
        "SELECT sql FROM sqlite_master WHERE name = 'system_audit_disclosure_revision_insert'",
      )
      .first<string>("sql"),
  ).toBe(guard)
  expect(await f.application.execute(f.command, now)).toMatchObject({ kind: "conflict" })
}, 30_000)
