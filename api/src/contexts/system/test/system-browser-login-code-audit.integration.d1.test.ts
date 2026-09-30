import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ConsumeSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/consume-system-browser-login-code.adapter"
import { CreateSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/create-system-browser-login-code.adapter"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const accountId = zAccountId.parse("fcd3b186-db56-4b04-8df7-acf9afd0c292")
const codeHash = "a".repeat(64)
const createdAt = new Date(1_000)
const expiresAt = new Date(61_000)

async function createDatabase(): Promise<D1Database> {
  const database = await createLocalD1Database({
    schema: readFileSync(
      new URL("../infrastructure/schema/system-core.sql", import.meta.url),
      "utf8",
    ),
  })
  await execSql(
    database,
    `INSERT INTO system_accounts (id, status, token_version, closed_at, created_at, updated_at) VALUES ('fcd3b186-db56-4b04-8df7-acf9afd0c292', 'active', 0, NULL, 1, 1);`,
  )
  return database
}

async function readAudits(database: D1Database) {
  const rows = await database
    .prepare(
      `SELECT actor_account_id, action, target_type, target_id, outcome, occurred_at
       FROM system_audit_events
       ORDER BY occurred_at, rowid`,
    )
    .all()
  return rows.results
}

describe("System browser login code audit", () => {
  test("発行と一度だけの消費を同じbatchの監査として記録する", async () => {
    const database = await createDatabase()
    const context = { env: { DB: database } }

    expect(
      await new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode({
        codeHash,
        accountId,
        createdAt,
        expiresAt,
      }),
    ).toBeNull()
    const consumer = new ConsumeSystemBrowserLoginCodeAdapter(context)
    expect(await consumer.consumeSystemBrowserLoginCode(codeHash, new Date(2_000))).toEqual({
      accountId,
    })
    expect(await consumer.consumeSystemBrowserLoginCode(codeHash, new Date(3_000))).toBeNull()

    expect(await readAudits(database)).toEqual([
      {
        actor_account_id: "fcd3b186-db56-4b04-8df7-acf9afd0c292",
        action: "auth.browser_login_code.created",
        target_type: "account",
        target_id: "fcd3b186-db56-4b04-8df7-acf9afd0c292",
        outcome: "succeeded",
        occurred_at: 1_000,
      },
      {
        actor_account_id: "fcd3b186-db56-4b04-8df7-acf9afd0c292",
        action: "auth.browser_login_code.consumed",
        target_type: "account",
        target_id: "fcd3b186-db56-4b04-8df7-acf9afd0c292",
        outcome: "succeeded",
        occurred_at: 2_000,
      },
    ])
  })

  test("失効済みcodeは消費も監査もしない", async () => {
    const database = await createDatabase()
    const context = { env: { DB: database } }
    await new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode({
      codeHash,
      accountId,
      createdAt,
      expiresAt,
    })

    expect(
      await new ConsumeSystemBrowserLoginCodeAdapter(context).consumeSystemBrowserLoginCode(
        codeHash,
        expiresAt,
      ),
    ).toBeNull()
    expect(await readAudits(database)).toHaveLength(1)
  })

  test("監査を記録できないときはcodeの発行も消費も確定しない", async () => {
    const database = await createDatabase()
    const context = { env: { DB: database } }
    await execSql(
      database,
      `INSERT INTO system_browser_login_codes (code_hash, account_id, created_at, expires_at) VALUES ('${"b".repeat(64)}', 'fcd3b186-db56-4b04-8df7-acf9afd0c292', 1000, 61000);`,
    )
    await execSql(database, "DROP TABLE system_audit_events;")

    expect(
      await new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode({
        codeHash,
        accountId,
        createdAt,
        expiresAt,
      }),
    ).toBeInstanceOf(Error)
    expect(
      await new ConsumeSystemBrowserLoginCodeAdapter(context).consumeSystemBrowserLoginCode(
        "b".repeat(64),
        new Date(2_000),
      ),
    ).toBeInstanceOf(Error)
    expect(
      await database
        .prepare("SELECT code_hash FROM system_browser_login_codes ORDER BY code_hash")
        .all(),
    ).toMatchObject({ results: [{ code_hash: "b".repeat(64) }] })
  })
})
