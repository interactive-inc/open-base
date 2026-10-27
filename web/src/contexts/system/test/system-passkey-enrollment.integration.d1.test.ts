import { completeSystemPasskeyEnrollment } from "@system/interface/operations/complete-system-passkey-enrollment"
import { findSystemPasskeyEnrollment } from "@system/interface/operations/find-system-passkey-enrollment"
import { issueSystemPasskeyEnrollment } from "@system/interface/operations/issue-system-passkey-enrollment"
import { readSystemAccountTokenVersion } from "@system/interface/operations/read-system-account-token-version"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST as RECOVER } from "@system/interface/routes/system.passkey-recoveries"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// 全migrationを適用したローカルD1を作るため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const accountId = zAccountId.parse("3f1c2b8e-7a4d-4e5f-9a6b-1c2d3e4f5a6b")
const identityId = "8a7b6c5d-4e3f-4a1b-9c8d-7e6f5a4b3c2d"
const now = new Date("2026-01-01T00:00:00.000Z")
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000)

async function fixture() {
  const database = await createLocalD1Database()
  await database.batch([
    database
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 2, ?2, ?2)`,
      )
      .bind(accountId, now.getTime()),
    database
      .prepare(
        `INSERT INTO system_identity_bindings
           (id, account_id, provider, subject, created_at, activated_at, revoked_at)
         VALUES (?1, ?2, 'passkey', ?2, ?3, NULL, NULL)`,
      )
      .bind(identityId, accountId, now.getTime()),
    database
      .prepare(
        `INSERT INTO system_identity_profiles (identity_id, email, email_verified, updated_at)
         VALUES (?1, 'you@example.com', 1, ?2)`,
      )
      .bind(identityId, now.getTime()),
  ])
  return { context: { env: { DB: database } }, database }
}

async function issue(context: { env: { DB: D1Database } }, at: Date, lifetime?: number) {
  const issued = await issueSystemPasskeyEnrollment(context, {
    accountId,
    reason: "recovery",
    issuedByAccountId: null,
    now: at,
    lifetimeMilliseconds: lifetime,
  })
  if (issued instanceof Error || issued === "no_identity") throw new Error("not issued")
  return issued.token
}

describe("パスキー招待", () => {
  test("登録が済むまでサインインできず、招待を一度だけ使ってIdentityを有効にする", async () => {
    const { context, database } = await fixture()
    expect(await readSystemAccountTokenVersion(context, accountId, "passkey")).toBeNull()

    const token = await issue(context, now)
    expect(await findSystemPasskeyEnrollment(context, { token, now })).toMatchObject({
      accountId,
      email: "you@example.com",
    })
    expect(await completeSystemPasskeyEnrollment(context, { token, now: later(1) })).toMatchObject({
      accountId,
    })
    expect(await completeSystemPasskeyEnrollment(context, { token, now: later(2) })).toBeNull()
    expect(await readSystemAccountTokenVersion(context, accountId, "passkey")).toBe(3)
    expect(
      await database
        .prepare("SELECT activated_at FROM system_identity_bindings WHERE id = ?1")
        .bind(identityId)
        .first<number>("activated_at"),
    ).toBe(later(1).getTime())
  })

  test("発行し直すと前の招待は使えない", async () => {
    const { context } = await fixture()
    const first = await issue(context, now)
    const second = await issue(context, later(1))

    expect(
      await completeSystemPasskeyEnrollment(context, { token: first, now: later(2) }),
    ).toBeNull()
    expect(
      await completeSystemPasskeyEnrollment(context, { token: second, now: later(2) }),
    ).not.toBeNull()
  })

  test("期限切れ、形式違い、停止したAccountの招待は使えない", async () => {
    const { context, database } = await fixture()
    const short = await issue(context, now, 60_000)
    expect(await findSystemPasskeyEnrollment(context, { token: short, now: later(2) })).toBeNull()
    expect(await findSystemPasskeyEnrollment(context, { token: "not-a-token", now })).toBeNull()

    const token = await issue(context, later(3))
    await database
      .prepare(
        "UPDATE system_accounts SET status = 'suspended', token_version = token_version + 1, updated_at = ?2 WHERE id = ?1",
      )
      .bind(accountId, later(4).getTime())
      .run()
    expect(await completeSystemPasskeyEnrollment(context, { token, now: later(5) })).toBeNull()
  })

  test("失効したパスキーのIdentityではサインインできない", async () => {
    const { context, database } = await fixture()
    await completeSystemPasskeyEnrollment(context, {
      token: await issue(context, now),
      now: later(1),
    })
    await database
      .prepare("UPDATE system_identity_bindings SET revoked_at = ?2 WHERE id = ?1")
      .bind(identityId, later(2).getTime())
      .run()

    expect(await readSystemAccountTokenVersion(context, accountId, "passkey")).toBeNull()
  })

  test("復旧はbootstrap secretを持つ運用者だけが、メールアドレスの一致するAccountへ発行できる", async () => {
    const { database } = await fixture()
    const app = systemFactory
      .createApp()
      .use("*", async (c, next) => {
        c.set("now", () => now)
        await next()
      })
      .post("/system/passkey-recoveries", ...RECOVER)
    const recover = (body: unknown, env: Record<string, unknown>) =>
      app.request(
        "/system/passkey-recoveries",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
        { DB: database, ...env },
      )
    const secret = { BOOTSTRAP_TOKEN: "passkey-recovery-test-token" }

    expect(
      (await recover({ token: secret.BOOTSTRAP_TOKEN, email: "you@example.com" }, {})).status,
    ).toBe(404)
    expect(
      (await recover({ token: "wrong-recovery-token", email: "you@example.com" }, secret)).status,
    ).toBe(401)
    expect(
      (await recover({ token: secret.BOOTSTRAP_TOKEN, email: "other@example.com" }, secret)).status,
    ).toBe(404)
    const issued = await recover(
      { token: secret.BOOTSTRAP_TOKEN, email: "YOU@example.com" },
      secret,
    )
    expect(issued.status).toBe(201)
    expect(await issued.json()).toMatchObject({ account_id: accountId })
    expect(
      await database
        .prepare(
          "SELECT reason, issued_by_account_id, expires_at - created_at AS lifetime FROM system_passkey_enrollments",
        )
        .first<{ reason: string; issued_by_account_id: string | null; lifetime: number }>(),
    ).toEqual({ reason: "recovery", issued_by_account_id: null, lifetime: 3_600_000 })
  })
})
