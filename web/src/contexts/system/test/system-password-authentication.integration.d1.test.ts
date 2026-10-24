import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { zIdentityId } from "@system/domain/schemas/identity/identity-id.schema"
import { identitySubjectSchema } from "@system/domain/schemas/identity/identity-subject.schema"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import {
  SystemPasswordCredentialAdapter,
  type SystemPasswordMaterialService,
} from "@system/infrastructure/adapters/auth/system-password-credential.adapter"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { testLiteralId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const identityOne = testLiteralId("identity-1")

const schema = `
  CREATE TABLE system_accounts (
    id TEXT PRIMARY KEY, legacy_id TEXT UNIQUE, status TEXT NOT NULL, token_version INTEGER NOT NULL,
    closed_at INTEGER,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
  CREATE TABLE system_identity_bindings (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, provider TEXT NOT NULL, subject TEXT NOT NULL,
    created_at INTEGER NOT NULL, activated_at INTEGER, revoked_at INTEGER
  );
  CREATE TABLE system_password_credentials (
    identity_id TEXT PRIMARY KEY, password_hash TEXT NOT NULL, changed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  );
`

const now = new Date("2026-01-01T00:00:00.000Z")
const subject = identitySubjectSchema.parse("account@example.com")

function createService(database: D1Database, verifiedHashes: string[]) {
  const material: SystemPasswordMaterialService = {
    dummyHash: "dummy-password-hash-for-constant-work",
    needsRehash: () => false,
    verify: async (_password, passwordHash) => {
      verifiedHashes.push(passwordHash)
      return passwordHash === "valid-password-hash-value"
    },
  }
  const repository = new SystemPasswordCredentialAdapter({ database })
  return {
    execute: (command: Parameters<typeof repository.authenticate>[0]) =>
      repository.authenticate(command, material),
  }
}

async function insertCredential(
  database: D1Database,
  status = "active",
  activatedAt: number | null = now.getTime(),
) {
  await database
    .prepare(
      `INSERT INTO system_accounts
         (id, status, token_version, closed_at, created_at, updated_at)
       VALUES ('d5858208-e680-4db8-a05d-8bf4f900c24e', ?1, 3, NULL, ?2, ?2)`,
    )
    .bind(status, now.getTime() - 1_000)
    .run()
  await database
    .prepare(
      `INSERT INTO system_identity_bindings
       VALUES ('${identityOne}', 'd5858208-e680-4db8-a05d-8bf4f900c24e', 'password', ?1, ?2, ?3, NULL)`,
    )
    .bind(subject, now.getTime() - 1_000, activatedAt)
    .run()
  await database
    .prepare(
      `INSERT INTO system_password_credentials
       VALUES ('${identityOne}', 'valid-password-hash-value', ?1, ?1, ?1)`,
    )
    .bind(now.getTime() - 1_000)
    .run()
}

describe("System password authentication", () => {
  test("active AccountとIdentityのcredentialだけを認証する", async () => {
    const database = await createLocalD1Database({ schema })
    await insertCredential(database)
    const verifiedHashes: string[] = []

    expect(
      await createService(database, verifiedHashes).execute({ subject, password: "secret", now }),
    ).toEqual({
      kind: "authenticated",
      accountId: zAccountId.parse("d5858208-e680-4db8-a05d-8bf4f900c24e"),
      identityId: zIdentityId.parse(identityOne),
      requiresPasswordRehash: false,
      tokenVersion: 3,
    })
    expect(verifiedHashes).toEqual(["valid-password-hash-value"])
  })

  test.each([
    ["missing", null, null],
    ["suspended", "suspended", now.getTime()],
    ["pending", "active", null],
  ] as const)("%sは同じ拒否へ畳む", async (_, status, activatedAt) => {
    const database = await createLocalD1Database({ schema })
    if (status !== null) await insertCredential(database, status, activatedAt)
    const verifiedHashes: string[] = []

    expect(
      await createService(database, verifiedHashes).execute({ subject, password: "secret", now }),
    ).toEqual({ kind: "rejected", reason: "invalid_credentials" })
    expect(verifiedHashes).toHaveLength(1)
    if (status === null) expect(verifiedHashes).toEqual(["dummy-password-hash-for-constant-work"])
  })

  test("D1障害をcredential拒否に偽装しない", async () => {
    const database = await createLocalD1Database({ schema })
    await execSql(database, "DROP TABLE system_identity_bindings")

    expect(
      await createService(database, []).execute({ subject, password: "secret", now }),
    ).toBeInstanceOf(Error)
  })
})
