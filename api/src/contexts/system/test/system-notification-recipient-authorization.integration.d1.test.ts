import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { SystemNotificationRepository } from "@system/infrastructure/repositories/notifications/system-notification.repository"
import { prepareSystemNotificationPublicationBatch } from "@system/interface/operations/prepare-system-notification-publication-batch"
import { GET as GET_MANY, PATCH as PATCH_MANY } from "@system/interface/routes/system.notifications"
import {
  GET as GET_ONE,
  PATCH as PATCH_ONE,
  DELETE,
} from "@system/interface/routes/system.notifications.$id"
import { GET as GET_UNREAD } from "@system/interface/routes/system.notifications.unread-count"
import { SystemD1AuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-authorization.adapter"
import { PrepareSystemReadAuthorizationAdapter } from "@system/infrastructure/adapters/iam/prepare-system-read-authorization.adapter"
import { ResolveBearerAccountAdapter } from "@system/infrastructure/adapters/auth/resolve-bearer-account.adapter"
import { AccessTokenService } from "@system/lib/auth/access-token-service"
import { SYSTEM_ACCESS_TOKEN_PROFILE } from "@system/lib/auth/system-access-token-profile"
import { systemFactory } from "@system/interface/request-environment/system-factory"

setDefaultTimeout(30_000)

async function fixture(legacy = false) {
  const database = (await SystemSessionTestContext.create()).database
  const clock = { now: new Date() }
  const accountId = zAccountId.parse(crypto.randomUUID())
  await database
    .prepare(
      "INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,0,0)",
    )
    .bind(accountId)
    .run()
  const applications = createSystemSessionApplications({
    context: { env: { DB: database } },
    jwtSecret: "example-recipient-authorization-secret",
    sessionTtlMilliseconds: 604800000,
  })
  if (applications instanceof Error) throw applications
  const session = await applications.issue.execute({
    accountId,
    tokenVersion: 0,
    now: new Date(clock.now.getTime() - 1000),
    auditContext: { authorizationJson: null, metadataJson: null },
  })
  if (session instanceof Error || session.kind === "rejected")
    throw new Error("session fixture failed")
  const accessToken = legacy
    ? await new AccessTokenService({ profile: SYSTEM_ACCESS_TOKEN_PROFILE }).create(
        { accountId, tokenVersion: 0 },
        "example-recipient-authorization-secret",
        new Date(clock.now.getTime() - 1000),
      )
    : session.accessToken
  if (accessToken instanceof Error) throw accessToken
  const messageId = crypto.randomUUID()
  const deliveryId = crypto.randomUUID()
  const statements = prepareSystemNotificationPublicationBatch({
    database,
    publications: [
      {
        message: {
          id: messageId,
          kind: "system:example",
          title: "Private example notification",
          body: "Private example body",
          source: null,
          action: null,
          resourceScope: null,
          priority: "normal",
          publicationKey: null,
          createdAt: clock.now,
        },
        deliveries: [{ id: deliveryId, recipientAccountId: accountId, deliveredAt: clock.now }],
      },
    ],
  })
  if (statements instanceof Error) throw statements
  await database.batch([...statements])
  const app = systemFactory
    .createApp()
    .use("*", async (context, next) => {
      context.set("now", () => clock.now)
      await next()
    })
    .get("/system/notifications", ...GET_MANY)
    .patch("/system/notifications", ...PATCH_MANY)
    .get("/system/notifications/unread-count", ...GET_UNREAD)
    .get("/system/notifications/:id", ...GET_ONE)
    .patch("/system/notifications/:id", ...PATCH_ONE)
    .delete("/system/notifications/:id", ...DELETE)
  const request = (method = "GET", path = "/system/notifications") =>
    app.request(
      path,
      {
        method,
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        ...(method === "PATCH" ? { body: JSON.stringify({ read: true }) } : {}),
      },
      { DB: database, JWT_SECRET: "example-recipient-authorization-secret" },
    )
  const revoke = () =>
    database
      .prepare("UPDATE system_sessions SET revoked_at=?2 WHERE account_id=?1")
      .bind(accountId, clock.now.getTime())
      .run()
  const state = () =>
    database
      .prepare("SELECT read_at,dismissed_at FROM system_notification_deliveries WHERE id=?1")
      .bind(deliveryId)
      .first()
  return {
    database,
    clock,
    accountId,
    deliveryId,
    request,
    revoke,
    state,
    accessToken,
    repository: new SystemNotificationRepository({ context: { env: { DB: database } } }),
  }
}

for (const read of ["list", "detail", "count"]) {
  for (const invalidation of ["logout", "account-version", "expiry"]) {
    test(`通知${read}の読取中の${invalidation}で本文と件数を返さない`, async () => {
      const f = await fixture()
      const invalidate = async () => {
        if (invalidation === "logout") await f.revoke()
        if (invalidation === "account-version")
          await f.database
            .prepare("UPDATE system_accounts SET token_version=1 WHERE id=?1")
            .bind(f.accountId)
            .run()
        if (invalidation === "expiry") f.clock.now = new Date(f.clock.now.getTime() + 3600000)
      }
      const originalList = f.repository.findMany.bind(f.repository)
      const originalDetail = f.repository.findByDeliveryIdForAccount.bind(f.repository)
      const originalCount = f.repository.countUnreadForAccount.bind(f.repository)
      const hooks = []
      if (read === "list")
        hooks.push(
          spyOn(SystemNotificationRepository.prototype, "findMany").mockImplementation(
            async (...args) => {
              const page = await originalList(...args)
              await invalidate()
              return page
            },
          ),
        )
      if (read === "detail")
        hooks.push(
          spyOn(
            SystemNotificationRepository.prototype,
            "findByDeliveryIdForAccount",
          ).mockImplementation(async (...args) => {
            const notification = await originalDetail(...args)
            await invalidate()
            return notification
          }),
        )
      if (read === "count")
        hooks.push(
          spyOn(SystemNotificationRepository.prototype, "countUnreadForAccount").mockImplementation(
            async (...args) => {
              const count = await originalCount(...args)
              await invalidate()
              return count
            },
          ),
        )
      try {
        const path =
          read === "list"
            ? "/system/notifications"
            : read === "count"
              ? "/system/notifications/unread-count"
              : `/system/notifications/${f.deliveryId}`
        const response = await f.request("GET", path)
        expect(response.status).not.toBe(200)
        const body = await response.text()
        expect(body).not.toContain("Private example")
        expect(body).not.toContain("unread_count")
        expect(body).not.toContain('"total"')
        expect(hooks[0]).toHaveBeenCalledTimes(1)
      } finally {
        for (const hook of hooks) hook.mockRestore()
      }
    })
  }
}

for (const write of ["read", "read-all", "dismiss"]) {
  test(`通知${write}は認証直後のlogoutで受信状態を変えない`, async () => {
    const f = await fixture()
    const authorization = new SystemD1AuthorizationAdapter({ env: { DB: f.database } })
    const original = authorization.resolveForAccount.bind(authorization)
    const authentication = spyOn(
      SystemD1AuthorizationAdapter.prototype,
      "resolveForAccount",
    ).mockImplementation(async (...args) => {
      const principal = await original(...args)
      await f.revoke()
      return principal
    })
    try {
      const method = write === "dismiss" ? "DELETE" : "PATCH"
      const path =
        write === "read-all" ? "/system/notifications" : `/system/notifications/${f.deliveryId}`
      const response = await f.request(method, path)
      expect(response.status).not.toBe(200)
      expect(response.status).not.toBe(204)
      expect(authentication).toHaveBeenCalledTimes(1)
      expect(await f.state()).toEqual({ read_at: null, dismissed_at: null })
    } finally {
      authentication.mockRestore()
    }
  })

  test(`通知${write}の保存中のlogoutを全取消しし、原因除去後に再試行できる`, async () => {
    const f = await fixture()
    const column = write === "dismiss" ? "dismissed_at" : "read_at"
    await f.database
      .prepare(`CREATE TRIGGER logout_during_transition AFTER UPDATE OF ${column} ON system_notification_deliveries
      BEGIN UPDATE system_sessions SET revoked_at=NEW.${column} WHERE account_id=NEW.recipient_account_id; END`)
      .run()
    const method = write === "dismiss" ? "DELETE" : "PATCH"
    const path =
      write === "read-all" ? "/system/notifications" : `/system/notifications/${f.deliveryId}`
    const response = await f.request(method, path)
    expect(response.status).not.toBe(200)
    expect(response.status).not.toBe(204)
    expect(await f.state()).toEqual({ read_at: null, dismissed_at: null })
    expect(
      await f.database
        .prepare(
          "SELECT count(*) AS total FROM system_sessions WHERE account_id=?1 AND revoked_at IS NOT NULL",
        )
        .bind(f.accountId)
        .first<number>("total"),
    ).toBe(0)
    await f.database.prepare("DROP TRIGGER logout_during_transition").run()
    expect((await f.request(method, path)).status).toBe(write === "dismiss" ? 204 : 200)
    const state = await f.state()
    expect(state?.[column]).toBe(f.clock.now.getTime())
  })
}

test("非表示対象の読取後にlogoutした場合も保存を拒否する", async () => {
  const f = await fixture()
  const original = f.repository.findDeliveryByIdForAccount.bind(f.repository)
  const lookup = spyOn(
    SystemNotificationRepository.prototype,
    "findDeliveryByIdForAccount",
  ).mockImplementation(async (...args) => {
    const delivery = await original(...args)
    await f.revoke()
    return delivery
  })
  try {
    expect((await f.request("DELETE", `/system/notifications/${f.deliveryId}`)).status).not.toBe(
      204,
    )
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(await f.state()).toEqual({ read_at: null, dismissed_at: null })
  } finally {
    lookup.mockRestore()
  }
})

test("他のAccountへ受信者proofを流用できない", async () => {
  const f = await fixture()
  const resolved = await new ResolveBearerAccountAdapter({
    env: { DB: f.database, JWT_SECRET: "example-recipient-authorization-secret" },
  }).resolve({ token: f.accessToken, now: f.clock.now })
  if (resolved.kind !== "accepted") throw new Error(`unexpected authentication: ${resolved.kind}`)
  const proof = await new PrepareSystemReadAuthorizationAdapter({
    env: { DB: f.database },
  }).prepare(resolved.readAuthentication, f.clock.now)
  if (proof === null || proof instanceof Error) throw new Error("proof fixture missing")
  const repository = new SystemNotificationRepository({
    context: { env: { DB: f.database } },
    recipientAuthorization: {
      accountId: f.accountId,
      assertions: () => proof.assertions(f.clock.now),
    },
  })
  const other = zAccountId.parse(crypto.randomUUID())
  expect(await repository.countUnreadForAccount(other)).toBeInstanceOf(Error)
  expect(await repository.markAllDeliveriesRead(other, f.clock.now)).toBeInstanceOf(Error)
  expect(
    await repository.findMany({ recipientAccountId: other, read: null, limit: 20, offset: 0 }),
  ).toBeInstanceOf(Error)
  expect(await f.state()).toEqual({ read_at: null, dismissed_at: null })
})

test("familyのない従来tokenも正常な受信者操作を維持する", async () => {
  const f = await fixture(true)
  expect((await f.request()).status).toBe(200)
  expect((await f.request("GET", `/system/notifications/${f.deliveryId}`)).status).toBe(200)
  expect((await f.request("GET", "/system/notifications/unread-count")).status).toBe(200)
  expect((await f.request("PATCH", `/system/notifications/${f.deliveryId}`)).status).toBe(200)
  expect((await f.request("PATCH")).status).toBe(200)
  expect((await f.request("DELETE", `/system/notifications/${f.deliveryId}`)).status).toBe(204)
})
