import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import type { HonoEnv } from "@/bindings"
import { requireBrowserDecision } from "@/api/http/decisions/require-browser-decision"
import { SystemServiceBindingAccountChannel } from "@system/interface/request-environment/system-service-binding-account-channel"
import {
  SystemSignedInSessionChannel,
  type SystemSignedInSession,
} from "@system/interface/request-environment/system-signed-in-session-channel"

const app = new Hono<HonoEnv>()
  .post("/applications/:id", (c) => {
    requireBrowserDecision(c, "application", c.req.param("id"))
    return c.json({ decided: true })
  })
  .post("/reviews/:id", (c) => {
    requireBrowserDecision(c, "review_sheet", c.req.param("id"))
    return c.json({ decided: true })
  })
  .onError((error) =>
    "getResponse" in error
      ? (error.getResponse as () => Response)()
      : new Response(null, { status: 500 }),
  )

const base = {} as HonoEnv["Bindings"]

function signedIn(method: SystemSignedInSession["method"]): HonoEnv["Bindings"] {
  const at = new Date("2026-01-01T00:00:00.000Z")
  return new SystemSignedInSessionChannel({ env: base }).attach({
    accountId: "00000000-0000-4000-8000-000000000001",
    sessionId: "session",
    authenticatedAt: at,
    createdAt: at,
    expiresAt: new Date(at.getTime() + 3_600_000),
    method,
    accountTokenVersion: 0,
  })
}

const post = (path: string, env: HonoEnv["Bindings"], site: string | null = "same-origin") =>
  app.request(
    `https://base.example.com${path}`,
    { method: "POST", headers: site === null ? {} : { "sec-fetch-site": site } },
    env,
  )

describe("requireBrowserDecision", () => {
  test.each(["password", "passkey", "oidc"] as const)(
    "%s でサインインした画面からの要求は通す",
    async (method) => {
      const response = await post("/applications/12", signedIn(method))
      expect(response.status).toBe(200)
    },
  )

  test("デバイス認証のセッションには判断の画面のURLを返す", async () => {
    const response = await post("/applications/12", signedIn("device"))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: "decisions are made on the decision page in a browser",
      code: "decision_requires_browser",
      decision_url: "https://base.example.com/decisions/applications/12",
    })
  })

  test("評価シートは評価の判断の画面のURLを返す", async () => {
    const id = "0b0e3a52-6f0e-4c58-9c9c-4f0f6f1f2a10"
    const response = await post(`/reviews/${id}`, signedIn("device"))
    expect(response.status).toBe(403)
    expect(((await response.json()) as { decision_url: string }).decision_url).toBe(
      `https://base.example.com/decisions/reviews/${id}`,
    )
  })

  test("セッションの無い要求（access tokenや機械credential）は通さない", async () => {
    const response = await post("/applications/12", base)
    expect(response.status).toBe(403)
  })

  test("Service Bindingの主体は通さない", async () => {
    const env = new SystemServiceBindingAccountChannel({ env: base }).attach(
      {} as Parameters<SystemServiceBindingAccountChannel<object>["attach"]>[0],
    )
    const response = await post("/applications/12", env)
    expect(response.status).toBe(403)
  })

  test.each(["cross-site", "same-site", "none", null])(
    "同じoriginの画面からでない要求（%s）は通さない",
    async (site) => {
      const response = await post("/applications/12", signedIn("oidc"), site)
      expect(response.status).toBe(403)
    },
  )
})
