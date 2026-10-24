import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { createSystemSessionApplications } from "@system/test/create-system-session-applications.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")
const accountId = zAccountId.parse("967ce6b6-442d-48f9-ad4b-f934103f1012")
const jwtSecret = "system-session-test-jwt-secret"

describe("authenticateSystemAccessToken", () => {
  test("access tokenと現在のSystem AccountEntity・IAMだけで主体を注入する", async () => {
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
         VALUES ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'system:reader', 'managed', 'System reader', ?1, ?1)`)
      .bind(now.getTime())
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('a290ac92-bf4b-434b-8443-8b6ceeb1cb85', 'system:read')`)
      .run()
    await fixture.database
      .prepare(`INSERT INTO system_role_bindings
           (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('ae18ee9b-62ff-4396-8971-165b0ac77248', ?1, 'a290ac92-bf4b-434b-8443-8b6ceeb1cb85', NULL, NULL, ?2, NULL)`)
      .bind(accountId, now.getTime())
      .run()

    const applications = createSystemSessionApplications({
      context: fixture.context,
      jwtSecret,
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
      .get("/protected", authenticateSystemAccessToken, (context) =>
        context.json({
          user_id: context.var.userId,
          role: context.var.role,
          permissions: [...context.var.permissions],
        }),
      )
    const request = (
      input: Parameters<typeof app.request>[0],
      init?: Parameters<typeof app.request>[1],
    ) => app.request(input, init, { DB: fixture.context.env.DB, JWT_SECRET: jwtSecret })
    const client = hc<typeof app>("http://system.test", { fetch: request })

    const accepted = await client.protected.$get({
      header: { authorization: `Bearer ${issuance.accessToken}` },
    })
    const acceptedBody = await accepted.json()
    expect(acceptedBody).toEqual({
      user_id: accountId,
      role: "system:reader",
      permissions: ["system:read"],
    })
    expect(accepted.status).toBe(200)

    const rejected = await client.protected.$get({
      header: { authorization: "Bearer invalid" },
    })
    expect(rejected.status).toBe(401)
  })
})
