import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"
import { SystemActiveAccountAdapter } from "@system/infrastructure/adapters/auth/system-active-account.adapter"
import { POST } from "@system/interface/routes/system.notifications"
import { systemFactory } from "@system/interface/request-environment/system-factory"

setDefaultTimeout(30_000)

async function fixture(kind: "human" | "agent" | "session" = "human") {
  const database = await createLocalD1Database({ schema: "" })
  for (const name of ["system-core", "system-integration", "system-principal"])
    await execSql(
      database,
      readFileSync(new URL(`../infrastructure/schema/${name}.sql`, import.meta.url), "utf8"),
    )
  const sender = zAccountId.parse(crypto.randomUUID())
  const recipient = zAccountId.parse(crypto.randomUUID())
  const roleId = crypto.randomUUID()
  const principalId = crypto.randomUUID()
  const credentialId = kind === "agent" ? crypto.randomUUID() : null
  const familyId = kind === "session" ? crypto.randomUUID() : null
  const clock = { now: new Date() }
  for (const id of [sender, recipient])
    await database
      .prepare(
        "INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,100,100)",
      )
      .bind(id)
      .run()
  await database
    .prepare(
      "INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES (?1,?2,?3,'Example sender',1,100,100)",
    )
    .bind(principalId, sender, kind === "session" ? "human" : kind)
    .run()
  if (credentialId !== null)
    await database
      .prepare(
        "INSERT INTO system_machine_credentials (id,principal_id,name,secret_hash,status,created_at,updated_at,last_used_at) VALUES (?1,?2,'Example credential',?3,'active',100,?4,?4)",
      )
      .bind(credentialId, principalId, "a".repeat(64), clock.now.getTime() - 1000)
      .run()
  if (familyId !== null)
    await database
      .prepare(`INSERT INTO system_sessions
      (id,account_id,family_id,token_hash,token_version,created_at,expires_at)
      VALUES (?1,?2,?3,?4,0,?5,?6)`)
      .bind(
        crypto.randomUUID(),
        sender,
        familyId,
        "a".repeat(64),
        clock.now.getTime() - 1000,
        clock.now.getTime() + 604800000,
      )
      .run()
  await database
    .prepare(
      "INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES (?1,'example:sender','custom','Example sender',100,100)",
    )
    .bind(roleId)
    .run()
  await database
    .prepare(
      "INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES (?1,'notification:send')",
    )
    .bind(roleId)
    .run()
  await database
    .prepare(
      "INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES (?1,?2,?3,100)",
    )
    .bind(crypto.randomUUID(), sender, roleId)
    .run()
  const token = await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
    {
      accountId: sender,
      tokenVersion: 0,
      ...(credentialId === null ? {} : { machineCredentialId: credentialId }),
      ...(familyId === null ? {} : { sessionFamilyId: familyId }),
    },
    "example-notification-test-secret",
    new Date(clock.now.getTime() - 1000),
  )
  if (token instanceof Error) throw token
  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => clock.now)
      await next()
    })
    .post("/system/notifications", ...POST)
  const send = () =>
    app.request(
      "/system/notifications",
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          recipient_account_ids: [recipient],
          kind: "system:test",
          title: "Example notification",
        }),
      },
      { DB: database, JWT_SECRET: "example-notification-test-secret" },
    )
  return { database, sender, recipient, roleId, credentialId, familyId, clock, send }
}

for (const change of ["permission", "token-version", "account", "expiry"]) {
  test(`publication rejects sender ${change} changes during recipient lookup`, async () => {
    const current = await fixture()
    const original = SystemActiveAccountAdapter.prototype.containsAll.bind(
      new SystemActiveAccountAdapter({ env: { DB: current.database } }),
    )
    const lookup = spyOn(SystemActiveAccountAdapter.prototype, "containsAll").mockImplementation(
      async (ids) => {
        const active = await original(ids)
        if (change === "permission")
          await current.database
            .prepare("DELETE FROM system_iam_role_permissions WHERE role_id=?1")
            .bind(current.roleId)
            .run()
        if (change === "token-version")
          await current.database
            .prepare("UPDATE system_accounts SET token_version=1 WHERE id=?1")
            .bind(current.sender)
            .run()
        if (change === "account")
          await current.database
            .prepare(
              "UPDATE system_accounts SET status='suspended',token_version=1,updated_at=?2 WHERE id=?1",
            )
            .bind(current.sender, current.clock.now.getTime())
            .run()
        if (change === "expiry")
          current.clock.now = new Date(current.clock.now.getTime() + 86_400_000)
        return active
      },
    )
    try {
      const response = await current.send()
      expect(response.status).not.toBe(201)
      expect(
        await current.database
          .prepare("SELECT count(*) FROM system_notification_messages")
          .first<number>("count(*)"),
      ).toBe(0)
      expect(
        await current.database
          .prepare("SELECT count(*) FROM system_notification_deliveries")
          .first<number>("count(*)"),
      ).toBe(0)
    } finally {
      lookup.mockRestore()
    }
  })
}

test("unchanged authorization can publish after recipient lookup", async () => {
  const current = await fixture()
  expect((await current.send()).status).toBe(201)
})

test("global administrators retain public notification publication", async () => {
  const current = await fixture()
  await current.database
    .prepare("DELETE FROM system_iam_role_permissions WHERE role_id=?1")
    .bind(current.roleId)
    .run()
  await current.database
    .prepare(
      "INSERT INTO system_iam_role_permissions (role_id,permission_key) VALUES (?1,'system:admin')",
    )
    .bind(current.roleId)
    .run()
  expect((await current.send()).status).toBe(201)
})

test("valid machine credentials can publish but revocation during lookup prevents saving", async () => {
  const current = await fixture("agent")
  expect((await current.send()).status).toBe(201)
  const original = SystemActiveAccountAdapter.prototype.containsAll.bind(
    new SystemActiveAccountAdapter({ env: { DB: current.database } }),
  )
  const lookup = spyOn(SystemActiveAccountAdapter.prototype, "containsAll").mockImplementation(
    async (ids) => {
      const active = await original(ids)
      await current.database
        .prepare(
          "UPDATE system_machine_credentials SET status='revoked',revoked_at=?2,updated_at=?2 WHERE id=?1",
        )
        .bind(current.credentialId, current.clock.now.getTime())
        .run()
      return active
    },
  )
  try {
    expect((await current.send()).status).not.toBe(201)
    expect(
      await current.database
        .prepare("SELECT count(*) FROM system_notification_messages")
        .first<number>("count(*)"),
    ).toBe(1)
    expect(
      await current.database
        .prepare("SELECT count(*) FROM system_notification_deliveries")
        .first<number>("count(*)"),
    ).toBe(1)
  } finally {
    lookup.mockRestore()
  }
})

test("authorization changes inside publication roll back Message, Delivery and the intervening change", async () => {
  const current = await fixture()
  await execSql(
    current.database,
    `CREATE TRIGGER revoke_during_notification AFTER INSERT ON system_notification_messages
    BEGIN DELETE FROM system_iam_role_permissions WHERE role_id=(SELECT id FROM system_iam_roles WHERE key='example:sender'); END;`,
  )
  expect((await current.send()).status).not.toBe(201)
  expect(
    await current.database
      .prepare("SELECT count(*) FROM system_notification_messages")
      .first<number>("count(*)"),
  ).toBe(0)
  expect(
    await current.database
      .prepare("SELECT count(*) FROM system_notification_deliveries")
      .first<number>("count(*)"),
  ).toBe(0)
  expect(
    await current.database
      .prepare("SELECT count(*) FROM system_iam_role_permissions WHERE role_id=?1")
      .bind(current.roleId)
      .first<number>("count(*)"),
  ).toBe(1)
  await execSql(current.database, "DROP TRIGGER revoke_during_notification")
  expect((await current.send()).status).toBe(201)
})

test("session-family revocation during recipient lookup prevents a session-bound token from publishing", async () => {
  const current = await fixture("session")
  expect((await current.send()).status).toBe(201)
  const original = SystemActiveAccountAdapter.prototype.containsAll.bind(
    new SystemActiveAccountAdapter({ env: { DB: current.database } }),
  )
  const lookup = spyOn(SystemActiveAccountAdapter.prototype, "containsAll").mockImplementation(
    async (ids) => {
      const active = await original(ids)
      await current.database
        .prepare("UPDATE system_sessions SET revoked_at=?2 WHERE family_id=?1")
        .bind(current.familyId, current.clock.now.getTime())
        .run()
      return active
    },
  )
  try {
    expect((await current.send()).status).not.toBe(201)
    expect(
      await current.database
        .prepare("SELECT count(*) FROM system_notification_messages")
        .first<number>("count(*)"),
    ).toBe(1)
    expect(
      await current.database
        .prepare("SELECT count(*) FROM system_notification_deliveries")
        .first<number>("count(*)"),
    ).toBe(1)
  } finally {
    lookup.mockRestore()
  }
})
