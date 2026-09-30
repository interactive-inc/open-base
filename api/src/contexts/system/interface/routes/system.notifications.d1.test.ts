import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import {
  DELETE as DELETE_ONE,
  GET as GET_ONE,
  PATCH as PATCH_ONE,
} from "@system/interface/routes/system.notifications.$id"
import {
  GET as GET_MANY,
  PATCH as PATCH_MANY,
  POST,
} from "@system/interface/routes/system.notifications"
import { GET as GET_UNREAD_COUNT } from "@system/interface/routes/system.notifications.unread-count"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { hc } from "hono/client"
import { testAccountId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const accountId = zAccountId.parse("bef4604e-c494-4c4b-a921-b479186557c2")

describe("System Notification HTTP", () => {
  test("publish・list・detail・既読・一括既読・dismissをAccount境界で完結する", async () => {
    const fixture = await SystemSessionTestContext.create()
    await fixture.database
      .prepare(`INSERT INTO system_accounts
           (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, ?2, ?2)`)
      .bind(accountId, now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_roles
           (id, key, kind, name, created_at, updated_at)
         VALUES ('319464a5-fe67-4a38-8e7f-07a8d64591d8', 'system:notification-sender', 'managed',
                 'Notification sender', ?1, ?1)`)
      .bind(now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('319464a5-fe67-4a38-8e7f-07a8d64591d8', 'notification:send')`)
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('01fed7f6-b372-4c2b-83ba-c5e22f432953', ?1, '319464a5-fe67-4a38-8e7f-07a8d64591d8', NULL, NULL, ?2, NULL)`)
      .bind(accountId, now.getTime())
      .run()

    const applications = createSystemSessionApplications({
      context: fixture.context,
      jwtSecret: "system-session-test-jwt-secret",
      sessionTtlMilliseconds: 604_800_000,
    })
    expect(applications).not.toBeInstanceOf(Error)
    if (applications instanceof Error) return
    const issuance = await applications.issue.execute({
      accountId,
      tokenVersion: 0,
      now: new Date(),
      auditContext: { authorizationJson: null, metadataJson: null },
    })
    expect(issuance).not.toBeInstanceOf(Error)
    if (issuance instanceof Error || issuance.kind === "rejected") return

    const app = systemFactory
      .createApp()
      .use("*", async (context, next) => {
        context.set("now", () => now)
        await next()
      })
      .get("/system/notifications", ...GET_MANY)
      .post("/system/notifications", ...POST)
      .patch("/system/notifications", ...PATCH_MANY)
      .get("/system/notifications/unread-count", ...GET_UNREAD_COUNT)
      .get("/system/notifications/:id", ...GET_ONE)
      .patch("/system/notifications/:id", ...PATCH_ONE)
      .delete("/system/notifications/:id", ...DELETE_ONE)
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        JWT_SECRET: "system-session-test-jwt-secret",
      })
    const client = hc<typeof app>("http://system.test", {
      fetch: request,
      headers: { authorization: `Bearer ${issuance.accessToken}` },
    })

    const published = await client.system.notifications.$post({
      json: {
        recipient_account_ids: [accountId],
        kind: "system:test",
        title: "System notification",
        body: "Portable notification body",
        source: { type: "system:test-source", id: "source-1" },
        action: { type: "system:test-action", id: "target-1" },
        resource_scope: { type: "system:test-resource", id: "resource-1" },
        priority: "high",
      },
    })
    expect(published.status).toBe(201)
    const publishedBody = await published.json()
    expect("delivery_ids" in publishedBody).toBe(true)
    if (!("delivery_ids" in publishedBody)) return
    const deliveryId = publishedBody.delivery_ids[0]
    expect(deliveryId).toBeString()
    if (deliveryId === undefined) return

    const unknownRecipient = await client.system.notifications.$post({
      json: {
        recipient_account_ids: [zAccountId.parse(testAccountId("unknown-account"))],
        kind: "system:test",
        title: "Unknown recipient",
        body: null,
        source: null,
      },
    })
    expect(Number(unknownRecipient.status)).toBe(404)

    const listed = await client.system.notifications.$get({ query: {} })
    expect(listed.status).toBe(200)
    expect(await listed.json()).toMatchObject({
      total: 1,
      notifications: [
        {
          id: deliveryId,
          action: { type: "system:test-action", id: "target-1" },
          resource_scope: { type: "system:test-resource", id: "resource-1" },
          priority: "high",
        },
      ],
    })

    const unread = await client.system.notifications["unread-count"].$get()
    expect(unread.status).toBe(200)
    expect(await unread.json()).toEqual({ unread_count: 1 })

    const detail = await client.system.notifications[":id"].$get({
      param: { id: deliveryId },
    })
    expect(detail.status).toBe(200)
    expect(await detail.json()).toMatchObject({
      id: deliveryId,
      read_at: null,
      action: { type: "system:test-action", id: "target-1" },
      resource_scope: { type: "system:test-resource", id: "resource-1" },
      priority: "high",
    })

    const marked = await client.system.notifications[":id"].$patch({
      param: { id: deliveryId },
      json: { read: true },
    })
    expect(marked.status).toBe(200)
    expect(await marked.json()).toMatchObject({ id: deliveryId, read_at: now.toISOString() })

    const markedAgain = await client.system.notifications.$patch({ json: { read: true } })
    expect(markedAgain.status).toBe(200)
    expect(await markedAgain.json()).toEqual({ marked_count: 0 })

    const dismissed = await client.system.notifications[":id"].$delete({
      param: { id: deliveryId },
    })
    expect(dismissed.status).toBe(204)

    const missing = await client.system.notifications[":id"].$get({
      param: { id: deliveryId },
    })
    expect(Number(missing.status)).toBe(404)
  })
})
