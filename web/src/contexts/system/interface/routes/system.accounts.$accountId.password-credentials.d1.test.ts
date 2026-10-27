import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemHTTPException } from "@system/interface/errors"
import { PATCH } from "@system/interface/routes/system.accounts.$accountId.password-credentials"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { hashPassword } from "@system/lib/auth/hash-password"
import { verifyPassword } from "@system/lib/auth/verify-password"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { requireIssuedSystemSession } from "@system/test/require-issued-system-session.test-support"
import { seedSystemStepUpGrant } from "@system/test/seed-system-step-up-grant.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { testAccountId, testLiteralId } from "@system/test/system-test-id.test-support"
import { expect, test } from "bun:test"

const actorAccountId = zAccountId.parse(testAccountId("password-reset-actor"))
const targetAccountId = zAccountId.parse(testAccountId("password-reset-target"))
const pepper = "password-reset-test-pepper"
const jwtSecret = "password-reset-test-jwt-secret"
const oldPassword = "old correct horse battery staple"
const newPassword = "new correct horse battery staple"
const now = new Date("2026-01-01T00:00:00.000Z")

async function createFixture() {
  const fixture = await SystemSessionTestContext.create()
  await execSql(
    fixture.database,
    `
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('${actorAccountId}', 'active', 0, 0, 0), ('${targetAccountId}', 'active', 0, 0, 0);
    INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
      VALUES ('${testLiteralId("password-reset-role")}', 'admin:role', 'custom', 'Admin', 0, 0);
    INSERT INTO system_iam_role_permissions (role_id, permission_key)
      VALUES ('${testLiteralId("password-reset-role")}', 'system:admin');
    INSERT INTO system_role_bindings (id, account_id, role_id, created_at)
      VALUES ('${testLiteralId("password-reset-binding")}', '${actorAccountId}', '${testLiteralId("password-reset-role")}', 0);
  `,
  )
  const applications = createSystemSessionApplications({
    context: fixture.context,
    jwtSecret,
    sessionTtlMilliseconds: 604_800_000,
  })
  if (applications instanceof Error) throw applications
  const issuance = requireIssuedSystemSession(
    await applications.issue.execute({
      accountId: actorAccountId,
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    }),
  )
  const stepUpToken = await seedSystemStepUpGrant(fixture, actorAccountId, now)
  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .onError((error, context) =>
      error instanceof SystemHTTPException
        ? context.json({ error: error.code }, error.status)
        : context.json({ error: "internal" }, 500),
    )
    .patch("/system/accounts/:accountId/password-credentials", ...PATCH)

  return {
    database: fixture.database,
    reset: () =>
      app.request(
        `/system/accounts/${targetAccountId}/password-credentials`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${issuance.accessToken}`,
            "x-system-step-up": stepUpToken,
          },
          body: JSON.stringify({ password: newPassword }),
        },
        { DB: fixture.database, JWT_SECRET: jwtSecret, PEPPER_SECRET: pepper },
      ),
  }
}

async function seedIdentities(database: D1Database) {
  const oldHash = await hashPassword(oldPassword, pepper)
  for (const state of ["first", "second", "pending", "revoked"]) {
    const identityId = testLiteralId(`password-reset-${state}`)
    await database
      .prepare(`INSERT INTO system_identity_bindings
      (id, account_id, provider, subject, created_at, activated_at, revoked_at)
      VALUES (?1, ?2, 'password', ?3, 0, ?4, ?5)`)
      .bind(
        identityId,
        targetAccountId,
        `${state}@example.com`,
        state === "pending" ? null : 0,
        state === "revoked" ? 5 : null,
      )
      .run()
    await database
      .prepare(`INSERT INTO system_password_credentials
      (identity_id, password_hash, changed_at, created_at, updated_at) VALUES (?1, ?2, 0, 0, 0)`)
      .bind(identityId, oldHash)
      .run()
  }
  return oldHash
}

test("管理者の再設定は有効なpassword Identity全件の旧パスワードを無効にする", async () => {
  const fixture = await createFixture()
  const oldHash = await seedIdentities(fixture.database)
  expect((await fixture.reset()).status).toBe(204)
  for (const state of ["first", "second", "pending", "revoked"]) {
    const credential = await fixture.database
      .prepare(
        "SELECT password_hash, changed_at FROM system_password_credentials WHERE identity_id = ?1",
      )
      .bind(testLiteralId(`password-reset-${state}`))
      .first<{ password_hash: string; changed_at: number }>()
    if (credential === null) throw new Error("expected credential")
    if (state === "pending" || state === "revoked") {
      expect(credential).toEqual({ password_hash: oldHash, changed_at: 0 })
      continue
    }
    expect(await verifyPassword(newPassword, credential.password_hash, pepper)).toBe(true)
    expect(await verifyPassword(oldPassword, credential.password_hash, pepper)).toBe(false)
    expect(credential.changed_at).toBe(now.getTime())
  }
  expect(
    await fixture.database
      .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
      .bind(targetAccountId)
      .first<{ token_version: number }>(),
  ).toEqual({ token_version: 1 })
  expect(
    (
      await fixture.database
        .prepare(
          "SELECT target_type, target_id FROM system_audit_events WHERE action = 'system.password_credential.reset'",
        )
        .all()
    ).results,
  ).toEqual([{ target_type: "system:account", target_id: targetAccountId }])
})

test("有効なpassword Identityが0件なら404のままにする", async () => {
  const fixture = await createFixture()
  expect((await fixture.reset()).status).toBe(404)
  expect(
    await fixture.database
      .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
      .bind(targetAccountId)
      .first<{ token_version: number }>(),
  ).toEqual({ token_version: 0 })
})

test("複数credentialの再設定は監査に失敗すると全件とセッション世代を戻す", async () => {
  const fixture = await createFixture()
  const oldHash = await seedIdentities(fixture.database)
  await execSql(
    fixture.database,
    `CREATE TRIGGER reject_password_reset_audit BEFORE INSERT ON system_audit_events
    WHEN NEW.action = 'system.password_credential.reset' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END;`,
  )
  expect((await fixture.reset()).status).toBe(503)
  const credentials = await fixture.database
    .prepare("SELECT password_hash, changed_at FROM system_password_credentials")
    .all()
  expect(credentials.results).toEqual(
    Array.from({ length: 4 }, () => ({ password_hash: oldHash, changed_at: 0 })),
  )
  expect(
    await fixture.database
      .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
      .bind(targetAccountId)
      .first<{ token_version: number }>(),
  ).toEqual({ token_version: 0 })
})

test("管理者の再設定は二段階認証の登録と待機中のログインの challenge も消す", async () => {
  const fixture = await createFixture()
  await seedIdentities(fixture.database)
  await fixture.database
    .prepare(`INSERT INTO system_totp_credentials
      (account_id, secret_ciphertext, status, last_used_step, recovery_code_hashes,
       created_at, updated_at, enabled_at)
      VALUES (?1, 'v1.placeholder-ciphertext', 'active', 1, '[]', 0, 0, 0)`)
    .bind(targetAccountId)
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_totp_login_challenges
      (challenge_hash, account_id, token_version, failed_attempts, created_at, expires_at)
      VALUES (?1, ?2, 0, 0, 0, ?3)`)
    .bind("a".repeat(64), targetAccountId, now.getTime() + 60_000)
    .run()

  expect((await fixture.reset()).status).toBe(204)

  for (const table of ["system_totp_credentials", "system_totp_login_challenges"]) {
    expect(
      await fixture.database
        .prepare(`SELECT count(*) AS total FROM ${table} WHERE account_id = ?1`)
        .bind(targetAccountId)
        .first<{ total: number }>(),
    ).toEqual({ total: 0 })
  }
})
