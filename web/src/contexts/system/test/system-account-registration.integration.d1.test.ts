import { expect, setDefaultTimeout, test } from "bun:test"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { hasSystemRegisteredEmail } from "@system/interface/operations/has-system-registered-email"
import { readSystemAccountRegistration } from "@system/interface/operations/read-system-account-registration"

setDefaultTimeout(30_000)

async function fixture() {
  const database = await createLocalD1Database({ schema: "" })
  await execSql(
    database,
    `
    CREATE TABLE system_identity_profiles (identity_id TEXT PRIMARY KEY, email TEXT);
    CREATE TABLE system_identity_bindings (id TEXT PRIMARY KEY, account_id TEXT, provider TEXT,
      subject TEXT, activated_at INTEGER, revoked_at INTEGER);
    CREATE TABLE system_iam_roles (id TEXT PRIMARY KEY, key TEXT);
    CREATE TABLE system_role_bindings (account_id TEXT, role_id TEXT, resource_type TEXT,
      revoked_at INTEGER);
    INSERT INTO system_identity_profiles VALUES ('pending', 'Pending@example.com'),
      ('revoked', 'Revoked@example.com'), ('external', 'External@example.com');
    INSERT INTO system_identity_bindings VALUES
      ('pending', 'account', 'passkey', 'account', NULL, NULL),
      ('revoked', 'revoked-account', 'password', 'revoked@example.com', 0, 1),
      ('external', 'account', 'oidc', 'external-subject', 0, NULL);
    INSERT INTO system_iam_roles VALUES ('role', 'member');
    INSERT INTO system_role_bindings VALUES ('account', 'role', NULL, NULL);
  `,
  )
  return { env: { DB: database } }
}

test("登録済みメールは大文字小文字を区別せず、未有効・失効済みのIdentityも重複になる", async () => {
  const context = await fixture()
  expect(await hasSystemRegisteredEmail(context, "pending@example.com")).toBe(true)
  expect(await hasSystemRegisteredEmail(context, "REVOKED@example.com")).toBe(true)
  expect(await hasSystemRegisteredEmail(context, "missing@example.com")).toBe(false)
})

test("登録の再送はパスキー有効化前でも照合でき、別の認証方式やsubjectとは一致しない", async () => {
  const context = await fixture()
  const input = {
    accountId: "account",
    roleKey: "member",
    provider: "passkey" as const,
    subject: null,
  }
  expect(await readSystemAccountRegistration(context, input)).toEqual({
    email: "Pending@example.com",
    hasExpectedRole: true,
  })
  expect(await readSystemAccountRegistration(context, { ...input, provider: "password" })).toEqual({
    email: null,
    hasExpectedRole: true,
  })
  expect(
    await readSystemAccountRegistration(context, {
      ...input,
      provider: "oidc",
      subject: "different",
    }),
  ).toEqual({
    email: null,
    hasExpectedRole: true,
  })
  expect(
    await readSystemAccountRegistration(context, {
      ...input,
      provider: "oidc",
      subject: "external-subject",
    }),
  ).toEqual({
    email: "External@example.com",
    hasExpectedRole: true,
  })
})

test("失効したIdentityと限定範囲・失効済みRoleは登録の一致に使わない", async () => {
  const context = await fixture()
  const input = {
    accountId: "account",
    roleKey: "member",
    provider: "passkey" as const,
    subject: null,
  }
  await context.env.DB.prepare("UPDATE system_role_bindings SET resource_type = 'example'").run()
  expect(await readSystemAccountRegistration(context, input)).toEqual({
    email: "Pending@example.com",
    hasExpectedRole: false,
  })
  await context.env.DB.prepare(
    "UPDATE system_role_bindings SET resource_type = NULL, revoked_at = 1",
  ).run()
  expect(await readSystemAccountRegistration(context, input)).toEqual({
    email: "Pending@example.com",
    hasExpectedRole: false,
  })
  expect(
    await readSystemAccountRegistration(context, {
      ...input,
      accountId: "revoked-account",
      provider: "password",
    }),
  ).toEqual({ email: null, hasExpectedRole: false })
})

test("保存先の障害は未登録扱いにせずエラーとして返す", async () => {
  const context = { env: { DB: await createLocalD1Database({ schema: "" }) } }
  expect(await hasSystemRegisteredEmail(context, "you@example.com")).toBeInstanceOf(Error)
  expect(
    await readSystemAccountRegistration(context, {
      accountId: "account",
      roleKey: "member",
      provider: "passkey",
      subject: null,
    }),
  ).toBeInstanceOf(Error)
})
