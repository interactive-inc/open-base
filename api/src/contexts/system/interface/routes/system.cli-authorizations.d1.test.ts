import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import type { SystemHonoEnv } from "@system/interface/request-environment/system-factory"
import { GET } from "@system/interface/routes/system.cli-authorizations"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-01-01T00:00:00.000Z")

async function createFixture(
  configuration: Readonly<{ identityLoginUrl?: string; apiOrigin?: string }> = Object.freeze({
    identityLoginUrl: "https://identity-provider.example/login",
    apiOrigin: "https://api.example.com",
  }),
) {
  const fixture = await SystemSessionTestContext.create()
  const app = new Hono<SystemHonoEnv>()
    .use("*", async (context, next) => {
      context.set("now", () => now)
      await next()
    })
    .get("/system/cli-authorizations", ...GET)
  const client = hc<typeof app>("http://system.test", {
    fetch: (input: Parameters<typeof app.request>[0], init?: Parameters<typeof app.request>[1]) =>
      app.request(input, init, {
        DB: fixture.context.env.DB,
        IDENTITY_LOGIN_URL: configuration.identityLoginUrl,
        API_ORIGIN: configuration.apiOrigin,
      }),
  })

  return Object.freeze({ client, fixture })
}

describe("GET /system/cli-authorizations", () => {
  test("stores a one-time PKCE state and redirects to the configured Identity provider", async () => {
    const { client, fixture } = await createFixture()

    const response = await client.system["cli-authorizations"].$get({
      query: { port: "51820", state: "cli-opaque-state-1" },
    })

    expect(response.status).toBe(302)
    const location = response.headers.get("Location")
    if (location === null) throw new Error("missing Location header")
    const url = new URL(location)
    expect(`${url.origin}${url.pathname}`).toBe("https://identity-provider.example/login")
    expect(url.searchParams.get("callback")).toBe(
      "https://api.example.com/system/cli-authorization-callback",
    )
    expect(url.searchParams.get("code_challenge_method")).toBe("S256")
    expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const brokerState = url.searchParams.get("state")
    expect(brokerState).not.toBeNull()
    expect(brokerState).not.toBe("cli-opaque-state-1")
    expect(
      await fixture.database
        .prepare(
          "SELECT port, cli_state, code_verifier FROM system_cli_login_states WHERE state = ?1",
        )
        .bind(brokerState)
        .first<Record<string, unknown>>(),
    ).toEqual({
      port: 51_820,
      cli_state: "cli-opaque-state-1",
      code_verifier: expect.stringMatching(/^[A-Za-z0-9_-]{43,128}$/),
    })
  })

  test("rejects an invalid port before creating authorization state", async () => {
    const { client, fixture } = await createFixture()

    const invalidPort = await client.system["cli-authorizations"].$get({
      query: { port: "70000", state: "cli-opaque-state-2" },
    })
    expect(Number(invalidPort.status)).toBe(400)
    expect(
      (
        await fixture.database
          .prepare("SELECT state FROM system_cli_login_states")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([])
  })

  test("fails closed when CLI Identity configuration is missing or insecure", async () => {
    const missing = await createFixture(Object.freeze({}))
    const insecure = await createFixture(
      Object.freeze({
        identityLoginUrl: "http://identity-provider.example/login",
        apiOrigin: "https://api.example.com",
      }),
    )

    const missingResponse = await missing.client.system["cli-authorizations"].$get({
      query: { port: "51820", state: "cli-opaque-state-3" },
    })
    const insecureResponse = await insecure.client.system["cli-authorizations"].$get({
      query: { port: "51820", state: "cli-opaque-state-4" },
    })

    expect(Number(missingResponse.status)).toBe(503)
    expect(Number(insecureResponse.status)).toBe(503)
    expect(
      (
        await missing.fixture.database
          .prepare("SELECT state FROM system_cli_login_states")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([])
    expect(
      (
        await insecure.fixture.database
          .prepare("SELECT state FROM system_cli_login_states")
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([])
  })
})
