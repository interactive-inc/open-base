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

const ownerAccountId = zAccountId.parse("0f3c2d64-5a1e-4c7b-9e2f-6d8a1b3c5e70")
const otherAccountId = zAccountId.parse("7a9e4b12-3c5d-4f6a-8b7c-9d0e1f2a3b4c")
const firstIdentity = testLiteralId("account-password-first")
const secondIdentity = testLiteralId("account-password-second")

type PasswordIdentitySeed = Readonly<{
  id: string
  accountId: string
  subject: string
  password: string
  createdAt: number
  activatedAt: number | null
  revokedAt: number | null
}>

function hashOf(password: string) {
  return `hash-of:${password}`
}

function createAccountService(database: D1Database, verifiedHashes: string[]) {
  const material: SystemPasswordMaterialService = {
    dummyHash: "dummy-password-hash-for-constant-work",
    needsRehash: () => false,
    verify: async (password, passwordHash) => {
      verifiedHashes.push(passwordHash)
      return passwordHash === hashOf(password)
    },
  }
  const repository = new SystemPasswordCredentialAdapter({ database })
  return {
    execute: (command: Parameters<typeof repository.authenticateAccount>[0]) =>
      repository.authenticateAccount(command, material),
  }
}

async function insertAccount(database: D1Database, accountId: string) {
  await database
    .prepare(
      `INSERT INTO system_accounts
         (id, status, token_version, closed_at, created_at, updated_at)
       VALUES (?1, 'active', 2, NULL, ?2, ?2)`,
    )
    .bind(accountId, now.getTime() - 10_000)
    .run()
}

async function insertPasswordIdentity(database: D1Database, seed: PasswordIdentitySeed) {
  await database
    .prepare(
      `INSERT INTO system_identity_bindings
       VALUES (?1, ?2, 'password', ?3, ?4, ?5, ?6)`,
    )
    .bind(seed.id, seed.accountId, seed.subject, seed.createdAt, seed.activatedAt, seed.revokedAt)
    .run()
  await database
    .prepare(`INSERT INTO system_password_credentials VALUES (?1, ?2, ?3, ?3, ?3)`)
    .bind(seed.id, hashOf(seed.password), seed.createdAt)
    .run()
}

function activeIdentity(
  id: string,
  password: string,
  createdAt: number,
  accountId: string = ownerAccountId,
): PasswordIdentitySeed {
  return {
    id,
    accountId,
    subject: `${id}@example.com`,
    password,
    createdAt,
    activatedAt: createdAt,
    revokedAt: null,
  }
}

describe("System account password authentication", () => {
  test("同じAccountの有効なlogin IDのどちらのpasswordでも、照合できたIDで認証する", async () => {
    const database = await createLocalD1Database({ schema })
    await insertAccount(database, ownerAccountId)
    await insertPasswordIdentity(
      database,
      activeIdentity(firstIdentity, "first-password", now.getTime() - 2_000),
    )
    await insertPasswordIdentity(
      database,
      activeIdentity(secondIdentity, "second-password", now.getTime() - 1_000),
    )

    for (const [password, identityId] of [
      ["first-password", firstIdentity],
      ["second-password", secondIdentity],
    ] as const) {
      const verifiedHashes: string[] = []
      expect(
        await createAccountService(database, verifiedHashes).execute({
          accountId: ownerAccountId,
          password,
          now,
        }),
      ).toEqual({
        kind: "authenticated",
        accountId: ownerAccountId,
        identityId: zIdentityId.parse(identityId),
        requiresPasswordRehash: false,
        tokenVersion: 2,
      })
      expect(verifiedHashes.at(-1)).toBe(hashOf(password))
    }
  })

  test.each([
    ["pending", null, null],
    ["revoked", now.getTime() - 1_000, now.getTime() - 500],
  ] as const)(
    "%sのlogin IDのpasswordは受理せず、照合もしない",
    async (_, activatedAt, revokedAt) => {
      const database = await createLocalD1Database({ schema })
      await insertAccount(database, ownerAccountId)
      await insertPasswordIdentity(
        database,
        activeIdentity(firstIdentity, "first-password", now.getTime() - 2_000),
      )
      await insertPasswordIdentity(database, {
        ...activeIdentity(secondIdentity, "second-password", now.getTime() - 1_000),
        activatedAt,
        revokedAt,
      })
      const verifiedHashes: string[] = []

      expect(
        await createAccountService(database, verifiedHashes).execute({
          accountId: ownerAccountId,
          password: "second-password",
          now,
        }),
      ).toEqual({ kind: "rejected", reason: "invalid_credentials" })
      expect(verifiedHashes).toEqual([hashOf("first-password")])
    },
  )

  test("別Accountのpasswordと誤ったpasswordを拒否し、有効なIDを1回ずつだけ照合する", async () => {
    const database = await createLocalD1Database({ schema })
    await insertAccount(database, ownerAccountId)
    await insertAccount(database, otherAccountId)
    await insertPasswordIdentity(
      database,
      activeIdentity(firstIdentity, "first-password", now.getTime() - 2_000),
    )
    await insertPasswordIdentity(
      database,
      activeIdentity(secondIdentity, "second-password", now.getTime() - 1_000),
    )
    await insertPasswordIdentity(
      database,
      activeIdentity(
        testLiteralId("other-account-password"),
        "other-password",
        now.getTime() - 1_000,
        otherAccountId,
      ),
    )

    for (const password of ["other-password", "wrong-password"]) {
      const verifiedHashes: string[] = []
      expect(
        await createAccountService(database, verifiedHashes).execute({
          accountId: ownerAccountId,
          password,
          now,
        }),
      ).toEqual({ kind: "rejected", reason: "invalid_credentials" })
      // password を最近変えた ID から照合する。
      expect(verifiedHashes).toEqual([hashOf("second-password"), hashOf("first-password")])
    }
  })

  test("有効なlogin IDが6件以上でも拒否せず、passwordを最近変えた5件を照合する", async () => {
    const database = await createLocalD1Database({ schema })
    await insertAccount(database, ownerAccountId)
    for (let index = 0; index < 6; index += 1) {
      await insertPasswordIdentity(
        database,
        activeIdentity(
          testLiteralId(`account-password-${index}`),
          `password-${index}`,
          now.getTime() - 10_000 + index,
        ),
      )
    }

    const latest: string[] = []
    expect(
      await createAccountService(database, latest).execute({
        accountId: ownerAccountId,
        password: "password-1",
        now,
      }),
    ).toMatchObject({
      kind: "authenticated",
      identityId: zIdentityId.parse(testLiteralId("account-password-1")),
    })
    expect(latest).toEqual(
      ["password-5", "password-4", "password-3", "password-2", "password-1"].map(hashOf),
    )

    // 最も古く変えた 6 件目は照合の対象外。1回の試行の照合は 5 回に収まる。
    const oldest: string[] = []
    expect(
      await createAccountService(database, oldest).execute({
        accountId: ownerAccountId,
        password: "password-0",
        now,
      }),
    ).toEqual({ kind: "rejected", reason: "invalid_credentials" })
    expect(oldest).toHaveLength(5)
  })
})
