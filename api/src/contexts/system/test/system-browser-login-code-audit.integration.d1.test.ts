import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zSessionFamilyId } from "@system/domain/schemas/auth/session-family-id.schema"
import { CreateSystemBrowserLoginCode } from "@system/application/auth/create-system-browser-login-code"
import { ConsumeSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/consume-system-browser-login-code.adapter"
import { CreateSystemBrowserLoginCodeAdapter } from "@system/infrastructure/adapters/auth/create-system-browser-login-code.adapter"
import { createSystemAttachmentTestDatabase } from "@system/test/create-system-attachment-test-database.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const accountId = zAccountId.parse("fcd3b186-db56-4b04-8df7-acf9afd0c292")
const codeHash = "a".repeat(64)
const createdAt = new Date(1_000)
const expiresAt = new Date(61_000)
const origin = {
  accountId,
  tokenVersion: 0,
  sessionFamilyId: null,
  machineCredentialId: null,
  identityBindingId: null,
}

async function createDatabase(): Promise<D1Database> {
  const database = await createSystemAttachmentTestDatabase()
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
        origin,
        createdAt,
        expiresAt,
      }),
    ).toBe("created")
    const consumer = new ConsumeSystemBrowserLoginCodeAdapter(context)
    expect(await consumer.consumeSystemBrowserLoginCode(codeHash, new Date(2_000))).toEqual({
      accountId,
      tokenVersion: 0,
      sessionFamilyActive: true,
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
      origin,
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

  test("発行を要求した認証のtoken versionが変わっていればcodeも発行監査も保存しない", async () => {
    const database = await createDatabase()
    const context = { env: { DB: database } }
    await execSql(
      database,
      "UPDATE system_accounts SET token_version = token_version + 1 WHERE id = 'fcd3b186-db56-4b04-8df7-acf9afd0c292';",
    )

    expect(
      await new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode({
        codeHash,
        origin,
        createdAt,
        expiresAt,
      }),
    ).toBe("rejected")
    expect(
      await database.prepare("SELECT code_hash FROM system_browser_login_codes").all(),
    ).toMatchObject({ results: [] })
    expect(await readAudits(database)).toEqual([])
  })

  test("監査を記録できないときはcodeの発行も消費も確定しない", async () => {
    const database = await createDatabase()
    const context = { env: { DB: database } }
    await execSql(
      database,
      `INSERT INTO system_browser_login_codes (code_hash, account_id, token_version, created_at, expires_at) VALUES ('${"b".repeat(64)}', 'fcd3b186-db56-4b04-8df7-acf9afd0c292', 0, 1000, 61000);`,
    )
    await execSql(database, "DROP TABLE system_audit_events;")

    expect(
      await new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode({
        codeHash,
        origin,
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

  describe("Session familyの期限", () => {
    const familyId = zSessionFamilyId.parse("0d6f1e2a-3b4c-4d5e-8f60-718293a4b5c6")

    async function insertFamilySession(database: D1Database, expiresAtMs: number) {
      await execSql(
        database,
        `INSERT INTO system_sessions (id, account_id, family_id, token_hash, token_version, created_at, expires_at, rotated_at, revoked_at)
         VALUES ('5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', 'fcd3b186-db56-4b04-8df7-acf9afd0c292', '${familyId}', '${"c".repeat(64)}', 0, 1, ${expiresAtMs}, NULL, NULL);`,
      )
    }

    test("発行元のSessionの期限が切れていれば、失効していなくてもcodeを保存しない", async () => {
      const database = await createDatabase()
      await insertFamilySession(database, 900)

      expect(
        await new CreateSystemBrowserLoginCodeAdapter({
          env: { DB: database },
        }).createSystemBrowserLoginCode({
          codeHash,
          origin: { ...origin, sessionFamilyId: familyId },
          createdAt,
          expiresAt,
        }),
      ).toBe("rejected")
      expect(await readAudits(database)).toEqual([])
    })

    test("交換までに発行元のSessionの期限が切れていれば、familyを有効として返さない", async () => {
      const database = await createDatabase()
      const context = { env: { DB: database } }
      await insertFamilySession(database, 1_500)

      expect(
        await new CreateSystemBrowserLoginCodeAdapter(context).createSystemBrowserLoginCode({
          codeHash,
          origin: { ...origin, sessionFamilyId: familyId },
          createdAt,
          expiresAt,
        }),
      ).toBe("created")
      expect(
        await new ConsumeSystemBrowserLoginCodeAdapter(context).consumeSystemBrowserLoginCode(
          codeHash,
          new Date(2_000),
        ),
      ).toEqual({ accountId, tokenVersion: 0, sessionFamilyActive: false })
    })
  })

  test("machine credentialで認証した要求にはcodeを発行しない", async () => {
    const database = await createDatabase()
    // credentialは有効なままにして、失効の照合ではなく発行の拒否で止まることを確かめる。
    await execSql(
      database,
      `INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at)
         VALUES ('2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f', 'fcd3b186-db56-4b04-8df7-acf9afd0c292', 'service', 'Service', 1, 1, 1);
       INSERT INTO system_machine_credentials (id, principal_id, name, secret_hash, status, created_at, updated_at)
         VALUES ('8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d', '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f', 'Service key', '${"d".repeat(64)}', 'active', 1, 1);`,
    )

    const creation = await new CreateSystemBrowserLoginCode({
      env: { DB: database },
      var: { now: () => createdAt },
    }).execute({
      authentication: {
        accountId,
        tokenVersion: 0,
        issuedAtMs: createdAt.getTime(),
        expiresAtMs: expiresAt.getTime(),
        machineCredentialId: "8a7b6c5d-4e3f-4a2b-9c1d-0e9f8a7b6c5d",
        identityBindingId: null,
        sessionFamilyId: null,
      },
      sessionFamilyId: null,
    })

    expect(creation).toBeNull()
    expect(
      await database.prepare("SELECT code_hash FROM system_browser_login_codes").all(),
    ).toMatchObject({ results: [] })
    expect(await readAudits(database)).toEqual([])
  })
})
