import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import {
  systemFactory,
  type SystemHonoEnv,
} from "@system/interface/request-environment/system-factory"
import { requireSystemAuthentication } from "@system/interface/middlewares/require-system-authentication"

const protectedHandler = systemFactory.createHandlers(
  requireSystemAuthentication,
  async (context) => context.json({ account_id: context.var.userId }),
)

describe("requireSystemAuthentication", () => {
  test("compositionが認証済みSystem主体を注入しなければ401で閉じる", async () => {
    const app = new Hono<SystemHonoEnv>().post("/", ...protectedHandler)

    const response = await app.request("http://localhost/", { method: "POST" })

    expect(response.status).toBe(401)
  })

  test("検証済みSystem主体だけをhandlerへ渡す", async () => {
    const app = new Hono<SystemHonoEnv>()
      .use("*", async (context, next) => {
        context.set("userId", "account-1")
        context.set("accountTokenVersion", 2)
        context.set("permissions", new Set(["system:read"]))
        context.set("role", "system-user")
        await next()
      })
      .post("/", ...protectedHandler)

    const response = await app.request("http://localhost/", { method: "POST" })

    expect(response.status).toBe(200)
    const body: unknown = await response.json()
    expect(body).toEqual({ account_id: "account-1" })
  })
})
