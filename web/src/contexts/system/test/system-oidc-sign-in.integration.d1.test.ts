import { findSystemOidcSignInAccount } from "@system/interface/operations/find-system-oidc-sign-in-account"
import { readSystemAccountTokenVersion } from "@system/interface/operations/read-system-account-token-version"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// 全migrationを適用したローカルD1を作るため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const accountId = zAccountId.parse("3f1c2b8e-7a4d-4e5f-9a6b-1c2d3e4f5a6b")
const identityId = "8a7b6c5d-4e3f-4a1b-9c8d-7e6f5a4b3c2d"
const now = new Date("2026-01-01T00:00:00.000Z").getTime()

async function fixture(
  options: Readonly<{
    activatedAt?: number | null
    revokedAt?: number | null
    status?: string
  }> = {},
) {
  const database = await createLocalD1Database()
  await database.batch([
    database
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, ?2, 3, ?3, ?3)`,
      )
      .bind(accountId, options.status ?? "active", now),
    database
      .prepare(
        `INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES (?1, ?2, 'oidc', 'subject-1', ?3, ?4, ?5)`,
      )
      .bind(
        identityId,
        accountId,
        now,
        options.activatedAt === undefined ? now : options.activatedAt,
        options.revokedAt ?? null,
      ),
    database
      .prepare(
        `INSERT INTO system_identity_profiles (identity_id, email, email_verified, updated_at)
         VALUES (?1, 'you@example.com', 1, ?2)`,
      )
      .bind(identityId, now),
  ])
  return { env: { DB: database } }
}

describe("OIDCのサインイン", () => {
  test("有効なIdentityのsubjectからAccountとメールアドレスを引き、OIDCでだけセッションを作れる", async () => {
    const context = await fixture()
    expect(await findSystemOidcSignInAccount(context, "subject-1")).toEqual({
      accountId,
      email: "you@example.com",
    })
    expect(await readSystemAccountTokenVersion(context, accountId, "oidc")).toBe(3)
    expect(await readSystemAccountTokenVersion(context, accountId, "passkey")).toBeNull()
  })

  test("知らないsubjectは見つからない", async () => {
    const context = await fixture()
    expect(await findSystemOidcSignInAccount(context, "subject-2")).toBeNull()
    expect(await findSystemOidcSignInAccount(context, "")).toBeNull()
  })

  test("有効化前や失効済みのIdentityではサインインできない", async () => {
    for (const options of [{ activatedAt: null }, { revokedAt: now + 1 }]) {
      const context = await fixture(options)
      expect(await findSystemOidcSignInAccount(context, "subject-1")).toBeNull()
      expect(await readSystemAccountTokenVersion(context, accountId, "oidc")).toBeNull()
    }
  })

  test("停止したAccountではサインインできない", async () => {
    const context = await fixture({ status: "suspended" })
    expect(await findSystemOidcSignInAccount(context, "subject-1")).toBeNull()
    expect(await readSystemAccountTokenVersion(context, accountId, "oidc")).toBeNull()
  })
})
