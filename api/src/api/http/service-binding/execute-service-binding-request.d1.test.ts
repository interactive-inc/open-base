import { executeServiceBindingRequest } from "@/api/http/service-binding/execute-service-binding-request"
import { createRuntimeApp } from "@/api/runtime-app"
import type { Bindings } from "@/env"
import { SystemServiceBindingAccountChannel } from "@system/interface/request-environment/system-service-binding-account-channel"
import { createSystemExternalAccessToken } from "@system/test/create-system-external-access-token.test-support"
import {
  createSystemIdentityTestKey,
  type SystemIdentityTestKey,
} from "@system/test/create-system-identity-test-key.test-support"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"

// ローカルD1のmigration適用と、System・Companyの初期化をHTTPで行うため、既定の5秒を超える。
setDefaultTimeout(60_000)

const issuer = "https://identity.example.com"
const apiAudience = "https://api.example.com"
const serviceBindingAudience = "urn:example:service-binding"
const rootPassword = "correct horse battery staple"
const rootSubject = "subject-root"
const plainSubject = "subject-plain"
const plainAccountId = "7b1f3e52-8f0e-4f53-9d38-1c2f7c0d9a11"

const app = createRuntimeApp()
let env: Bindings
let key: SystemIdentityTestKey

type Called = { count: number }

function spyApp(called: Called, response: () => Response) {
  return {
    fetch: () => {
      called.count += 1
      return response()
    },
  }
}

async function http(
  method: string,
  path: string,
  options: Readonly<{ token?: string; headers?: Record<string, string>; body?: unknown }> = {},
): Promise<Readonly<{ status: number; body: unknown }>> {
  const response = await app.request(
    path,
    {
      method,
      headers: {
        "content-type": "application/json",
        ...(options.token === undefined ? {} : { authorization: `Bearer ${options.token}` }),
        ...options.headers,
      },
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    },
    env,
  )
  const text = await response.text()
  return { status: response.status, body: text.length === 0 ? null : JSON.parse(text) }
}

function tokenOf(subject: string, audience: string): Promise<string> {
  return createSystemExternalAccessToken({
    signingKey: key.signingKey,
    keyId: key.keyId,
    now: new Date(),
    subject,
    issuer,
    audience,
    claims: { email: "you@example.com", email_verified: true, name: "Example User" },
  })
}

function rpc(
  accessToken: unknown,
  input: unknown,
  target: Parameters<typeof executeServiceBindingRequest>[0]["app"] = app,
) {
  return executeServiceBindingRequest({
    app: target,
    env,
    executionContext: null,
    accessToken,
    input,
  })
}

beforeAll(async () => {
  key = await createSystemIdentityTestKey("service-binding-request-key")
  env = {
    DB: await createLocalD1Database(),
    BOOTSTRAP_TOKEN: "service-binding-request-bootstrap-token",
    JWT_SECRET: "service-binding-request-jwt-secret",
    PEPPER_SECRET: "service-binding-request-pepper",
    AUDIT_HMAC_SECRET: "service-binding-request-audit-secret",
    COMPANY_TIME_ZONE: "Asia/Tokyo",
    IDENTITY_ACCESS_TOKEN_ISSUER: issuer,
    IDENTITY_ACCESS_TOKEN_AUDIENCE: apiAudience,
    SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE: serviceBindingAudience,
    IDENTITY_JWKS: key.jwks,
  }

  expect(
    (
      await http("POST", "/system/bootstrap", {
        body: { token: env.BOOTSTRAP_TOKEN, email: "root@example.com", password: rootPassword },
      })
    ).status,
  ).toBe(201)
  const session = await http("POST", "/system/sessions", {
    body: { subject: "root@example.com", password: rootPassword },
  })
  const root = z.object({ access_token: z.string(), account_id: z.string() }).parse(session.body)
  const company = await http("POST", "/company/bootstrap", {
    token: root.access_token,
    headers: { "idempotency-key": "service-binding-request-company" },
    body: {
      name: "First Member",
      code: "FIRST-001",
      organization_name: "Example Company",
      representative_name: "Confirmed Representative",
      initial_responsibilities: [],
      hire_date: "2026-01-01",
      employment_type: "FULL_TIME",
      locale: "ja-JP",
      time_zone: "Asia/Tokyo",
      fiscal_year_start_month: 4,
      reason: "Confirmed company facts",
    },
  })
  expect(company.status).toBe(201)

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES ('b5d0c0c1-3f7e-4d8e-9a54-0c5c1f0e2a01', ?1, 'oidc', ?2, 0, 0, NULL)`,
    ).bind(root.account_id, rootSubject),
    env.DB.prepare(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES (?1, 'active', 0, 0, 0)`,
    ).bind(plainAccountId),
    env.DB.prepare(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES ('b5d0c0c1-3f7e-4d8e-9a54-0c5c1f0e2a02', ?1, 'oidc', ?2, 0, 0, NULL)`,
    ).bind(plainAccountId, plainSubject),
  ])
})

describe("executeServiceBindingRequest", () => {
  test("Companyの読み取りrouteは、同じ本人のHTTP呼び出しと同じ応答を返す", async () => {
    const viaHttp = await http("GET", "/company/current-profile", {
      token: await tokenOf(rootSubject, apiAudience),
    })
    const viaRpc = await rpc(await tokenOf(rootSubject, serviceBindingAudience), {
      method: "GET",
      path: "/company/current-profile",
    })

    expect(viaHttp.status).toBe(200)
    expect(viaRpc).toEqual({
      ok: true,
      status: 200,
      headers: { contentType: "application/json" },
      body: viaHttp.body,
      truncated: false,
    })
    expect(structuredClone(viaRpc)).toEqual(viaRpc)
  })

  test("権限の無いrouteは、HTTP呼び出しと同じ403を返す", async () => {
    const viaHttp = await http("GET", "/system/accounts", {
      token: await tokenOf(plainSubject, apiAudience),
    })
    const viaRpc = await rpc(await tokenOf(plainSubject, serviceBindingAudience), {
      method: "GET",
      path: "/system/accounts",
    })

    expect(viaHttp.status).toBe(403)
    expect(viaRpc).toMatchObject({ ok: true, status: 403, body: viaHttp.body })
  })

  test("queryと本文をHTTPと同じ形で渡す", async () => {
    const token = await tokenOf(rootSubject, serviceBindingAudience)
    const viaRpc = await rpc(token, {
      method: "POST",
      path: "/system/accounts",
      query: { unused: "value" },
      body: { email: 42 },
    })
    const viaHttp = await http("POST", "/system/accounts?unused=value", {
      token: await tokenOf(rootSubject, apiAudience),
      body: { email: 42 },
    })

    expect(viaRpc).toMatchObject({ ok: true, status: viaHttp.status })
  })

  test("認証できないtokenはappを呼ばずにrejectedを返す", async () => {
    const called = { count: 0 }
    const target = spyApp(called, () => new Response("unexpected"))
    for (const accessToken of [
      await tokenOf(rootSubject, apiAudience),
      await tokenOf("subject-unknown", serviceBindingAudience),
      "not-a-token",
      undefined,
    ]) {
      expect(
        await rpc(accessToken, { method: "GET", path: "/company/current-profile" }, target),
      ).toEqual({ ok: false, reason: "rejected" })
    }
    expect(called.count).toBe(0)
  })

  test("不正な入力と資格情報を発行するrouteはappを呼ばずにrejectedを返す", async () => {
    const called = { count: 0 }
    const target = spyApp(called, () => new Response("unexpected"))
    const token = await tokenOf(rootSubject, serviceBindingAudience)
    const inputs: ReadonlyArray<unknown> = [
      undefined,
      "GET /company/current-profile",
      { method: "TRACE", path: "/company/current-profile" },
      { method: "get", path: "/company/current-profile" },
      { method: "GET", path: "https://example.com/company/current-profile" },
      { method: "GET", path: "//example.com/company/current-profile" },
      { method: "GET", path: "company/current-profile" },
      { method: "GET", path: "/company/../system/accounts" },
      { method: "GET", path: "/company/%2e%2e/system/accounts" },
      { method: "GET", path: "/company/%2F/accounts" },
      { method: "GET", path: "/company/current-profile?x=1" },
      { method: "GET", path: "/company/current-profile#x" },
      { method: "GET", path: "/company\\current-profile" },
      { method: "GET", path: `/${"a".repeat(2_048)}` },
      { method: "GET", path: "/company/current-profile", extra: true },
      { method: "GET", path: "/company/current-profile", query: { x: 1 } },
      { method: "GET", path: "/company/current-profile", query: ["x"] },
      {
        method: "GET",
        path: "/company/current-profile",
        query: Object.fromEntries(Array.from({ length: 101 }, (_, index) => [`k${index}`, "v"])),
      },
      { method: "GET", path: "/company/current-profile", body: {} },
      { method: "POST", path: "/system/accounts", body: "x".repeat(1_000_001) },
      { method: "POST", path: "/system/accounts", body: 1n },
      { method: "POST", path: "/system/browser-login-codes" },
      { method: "POST", path: "/system/browser-login-codes/" },
      { method: "POST", path: "/system/oauth/authorizations" },
      { method: "POST", path: "/System/OAuth/MCP-Grants" },
      { method: "POST", path: "/system/%62rowser-login-codes" },
      { method: "POST", path: "/system/browser-login-codes%2F" },
      { method: "POST", path: "/%73ystem/oauth/%61uthorizations" },
      { method: "POST", path: "/system/oauth/mcp%2Dgrants" },
    ]

    for (const input of inputs) {
      expect(await rpc(token, input, target)).toEqual({ ok: false, reason: "rejected" })
    }
    expect(called.count).toBe(0)
  })

  test("上限を超える応答本文は切り詰めて文字列で返す", async () => {
    const token = await tokenOf(rootSubject, serviceBindingAudience)
    const large = spyApp(
      { count: 0 },
      () =>
        new Response(JSON.stringify({ value: "a".repeat(1_100_000) }), {
          headers: { "content-type": "application/json" },
        }),
    )
    const result = await rpc(token, { method: "GET", path: "/company/current-profile" }, large)

    expect(result).toMatchObject({ ok: true, status: 200, truncated: true })
    if (!result.ok || typeof result.body !== "string") throw new Error("expected truncated text")
    expect(result.body.length).toBe(1_000_000)

    const multibyte = spyApp(
      { count: 0 },
      () => new Response("あ".repeat(400_000), { headers: { "content-type": "text/plain" } }),
    )
    const cut = await rpc(token, { method: "GET", path: "/company/current-profile" }, multibyte)
    if (!cut.ok || typeof cut.body !== "string") throw new Error("expected truncated text")
    expect(cut.truncated).toBe(true)
    expect(cut.body).toBe("あ".repeat(333_333))

    const text = spyApp(
      { count: 0 },
      () => new Response("plain", { status: 202, headers: { "content-type": "text/plain" } }),
    )
    expect(await rpc(token, { method: "HEAD", path: "/company/current-profile" }, text)).toEqual({
      ok: true,
      status: 202,
      headers: { contentType: "text/plain" },
      body: null,
      truncated: false,
    })
  })

  test("HTTP要求はheaderでもenvの複製でも、RPCの主体を使えない", async () => {
    const forgedHeaders: ReadonlyArray<Record<string, string>> = [
      {},
      { "x-service-binding-account": plainAccountId },
      { "cf-connecting-ip": "127.0.0.1", "x-open-base-client": "cli" },
      { cookie: `account=${plainAccountId}` },
    ]
    for (const headers of forgedHeaders) {
      expect((await http("GET", "/company/current-profile", { headers })).status).toBe(401)
    }

    const resolved = await rpc(await tokenOf(rootSubject, serviceBindingAudience), {
      method: "GET",
      path: "/company/current-profile",
    })
    expect(resolved).toMatchObject({ ok: true, status: 200 })

    const captured: { env: object | null } = { env: null }
    await rpc(
      await tokenOf(rootSubject, serviceBindingAudience),
      { method: "GET", path: "/company/current-profile" },
      {
        fetch: (_request: Request, attached: Bindings) => {
          captured.env = attached
          return new Response(null, { status: 204 })
        },
      },
    )
    if (captured.env === null) throw new Error("expected the attached env")
    expect(new SystemServiceBindingAccountChannel({ env: captured.env }).read()).not.toBeNull()
    expect(new SystemServiceBindingAccountChannel({ env: { ...captured.env } }).read()).toBeNull()
    expect(new SystemServiceBindingAccountChannel({ env }).read()).toBeNull()
    expect(Object.keys(captured.env).sort()).toEqual(Object.keys(env).sort())
  })
})
