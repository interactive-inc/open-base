import { resolveSystemServiceBindingWhoami } from "@system/interface/operations/resolve-system-service-binding-whoami"
import { createSystemExternalAccessToken } from "@system/test/create-system-external-access-token.test-support"
import {
  createSystemIdentityTestKey,
  type SystemIdentityTestKey,
} from "@system/test/create-system-identity-test-key.test-support"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const now = new Date("2026-08-20T09:00:00.000Z")
const issuer = "https://identity.example.com"
const apiAudience = "https://api.example.com"
const serviceBindingAudience = "urn:example:service-binding"
const activeAccountId = "4f810255-55d5-43c8-b43f-2df5e7bf5a3c"

let database: D1Database
let key: SystemIdentityTestKey

beforeAll(async () => {
  database = await createLocalD1Database()
  key = await createSystemIdentityTestKey("service-binding-test-key")
  await execSql(
    database,
    `
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES
      ('${activeAccountId}', 'active', 0, 0, 0),
      ('cd2c4c4e-c038-4a89-8411-6f779077ac7e', 'suspended', 0, 0, 0),
      ('7b1f3e52-8f0e-4f53-9d38-1c2f7c0d9a11', 'active', 0, 0, 0);
    INSERT INTO system_identity_bindings
      (id, account_id, provider, subject, created_at, activated_at, revoked_at) VALUES
      ('b5d0c0c1-3f7e-4d8e-9a54-0c5c1f0e2a01', '${activeAccountId}', 'oidc', 'subject-active', 0, 0, NULL),
      ('b5d0c0c1-3f7e-4d8e-9a54-0c5c1f0e2a02', 'cd2c4c4e-c038-4a89-8411-6f779077ac7e', 'oidc', 'subject-suspended', 0, 0, NULL),
      ('b5d0c0c1-3f7e-4d8e-9a54-0c5c1f0e2a03', '${activeAccountId}', 'oidc', 'subject-revoked', 0, 0, 1),
      ('b5d0c0c1-3f7e-4d8e-9a54-0c5c1f0e2a04', '${activeAccountId}', 'oidc', 'subject-pending', 0, NULL, NULL),
      ('b5d0c0c1-3f7e-4d8e-9a54-0c5c1f0e2a05', '7b1f3e52-8f0e-4f53-9d38-1c2f7c0d9a11', 'oidc', 'subject-machine', 0, 0, NULL);
    INSERT INTO system_principals
      (id, account_id, kind, name, connector_id, revision, created_at, updated_at) VALUES
      ('f198534a-16c4-4f9b-8359-9a8b4b474f09', '7b1f3e52-8f0e-4f53-9d38-1c2f7c0d9a11', 'service', 'Test machine', NULL, 1, 0, 0);
  `,
  )
})

function environment(overrides: Readonly<Record<string, string | undefined>> = {}) {
  return {
    DB: database,
    IDENTITY_ACCESS_TOKEN_ISSUER: issuer,
    IDENTITY_ACCESS_TOKEN_AUDIENCE: apiAudience,
    SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE: serviceBindingAudience,
    IDENTITY_JWKS: key.jwks,
    ...overrides,
  }
}

function tokenOf(
  options: Partial<Parameters<typeof createSystemExternalAccessToken>[0]> = {},
): Promise<string> {
  return createSystemExternalAccessToken({
    signingKey: key.signingKey,
    keyId: key.keyId,
    now,
    subject: "subject-active",
    issuer,
    audience: serviceBindingAudience,
    ...options,
  })
}

const rejected = { ok: false, reason: "rejected" } as const
const unavailable = { ok: false, reason: "unavailable" } as const

describe("resolveSystemServiceBindingWhoami", () => {
  test("RPC入口のaudを持つtokenは、email・nameが無くてもSystem Accountへ解決する", async () => {
    const resolution = await resolveSystemServiceBindingWhoami(
      { env: environment() },
      { accessToken: await tokenOf(), now },
    )

    expect(resolution).toEqual({ ok: true, account: { accountId: activeAccountId } })
  })

  test("HTTP API向けのtokenはemail等を持っていてもRPC入口で拒否する", async () => {
    const token = await tokenOf({
      audience: apiAudience,
      claims: { email: "you@example.com", email_verified: true, name: "Example User" },
    })

    expect(
      await resolveSystemServiceBindingWhoami({ env: environment() }, { accessToken: token, now }),
    ).toEqual(rejected)
  })

  test("audが複数ある、または他のaudを含むtokenは拒否する", async () => {
    for (const audience of [
      [serviceBindingAudience, apiAudience],
      [serviceBindingAudience, "urn:example:other"],
      ["urn:example:other"],
    ]) {
      const token = await tokenOf({ audience })
      expect(
        await resolveSystemServiceBindingWhoami(
          { env: environment() },
          { accessToken: token, now },
        ),
      ).toEqual(rejected)
    }
  })

  test("RPC入口のaudが未設定、空、HTTP APIやログイン用のaudと同じなら全て拒否する", async () => {
    const token = await tokenOf()
    for (const env of [
      environment({ SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE: undefined }),
      environment({ SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE: "" }),
      environment({ IDENTITY_ACCESS_TOKEN_AUDIENCE: serviceBindingAudience }),
      environment({ IDENTITY_AUDIENCE: serviceBindingAudience }),
      environment({ IDENTITY_ACCESS_TOKEN_ISSUER: "", IDENTITY_ISSUER: undefined }),
    ]) {
      expect(await resolveSystemServiceBindingWhoami({ env }, { accessToken: token, now })).toEqual(
        rejected,
      )
    }
  })

  test("HTTP APIのaudが未設定でも、RPC入口のaudだけで受理する", async () => {
    const resolution = await resolveSystemServiceBindingWhoami(
      { env: environment({ IDENTITY_ACCESS_TOKEN_AUDIENCE: undefined }) },
      { accessToken: await tokenOf(), now },
    )

    expect(resolution).toEqual({ ok: true, account: { accountId: activeAccountId } })
  })

  test("委任・交換を表すact claimを持つtokenは拒否する", async () => {
    const token = await tokenOf({ claims: { act: { sub: "subject-actor" } } })

    expect(
      await resolveSystemServiceBindingWhoami({ env: environment() }, { accessToken: token, now }),
    ).toEqual(rejected)
  })

  test("署名・発行者・期限・型・必須claimが不正なtokenは拒否する", async () => {
    const otherKey = await createSystemIdentityTestKey("service-binding-test-key")
    const tokens = [
      await createSystemExternalAccessToken({
        signingKey: otherKey.signingKey,
        keyId: key.keyId,
        now,
        subject: "subject-active",
        issuer,
        audience: serviceBindingAudience,
      }),
      await tokenOf({ issuer: "https://other-identity.example.com" }),
      await tokenOf({ now: new Date(now.getTime() - 3_600_000) }),
      await tokenOf({ expiresInSeconds: 0 }),
      await tokenOf({ typ: "JWT" }),
      await tokenOf({ claims: { client_id: undefined } }),
      await tokenOf({ claims: { scope: undefined } }),
      await tokenOf({ claims: { jti: undefined } }),
      "not-a-token",
    ]

    for (const token of tokens) {
      expect(
        await resolveSystemServiceBindingWhoami(
          { env: environment() },
          { accessToken: token, now },
        ),
      ).toEqual(rejected)
    }
  })

  test("未知・未有効化・失効したsubject、非activeまたは機械主体のAccountは拒否する", async () => {
    for (const subject of [
      "subject-unknown",
      "subject-pending",
      "subject-revoked",
      "subject-suspended",
      "subject-machine",
    ]) {
      const token = await tokenOf({ subject })
      expect(
        await resolveSystemServiceBindingWhoami(
          { env: environment() },
          { accessToken: token, now },
        ),
      ).toEqual(rejected)
    }
  })

  test("検証鍵を解決できないときはunavailableを返す", async () => {
    const token = await tokenOf()
    for (const env of [
      environment({ IDENTITY_JWKS: "not-json" }),
      environment({
        IDENTITY_JWKS: undefined,
        IDENTITY_ACCESS_TOKEN_ISSUER: "http://identity.example.com",
      }),
    ]) {
      expect(await resolveSystemServiceBindingWhoami({ env }, { accessToken: token, now })).toEqual(
        unavailable,
      )
    }
  })

  test("discovery後のremote JWKSを取得できないときはunavailableを返す", async () => {
    const remoteIssuer = "https://remote-identity.example.com"
    const originalFetch = globalThis.fetch
    globalThis.fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0]) => {
        const url = input instanceof Request ? input.url : String(input)
        if (url === `${remoteIssuer}/.well-known/openid-configuration`) {
          return Response.json({ issuer: remoteIssuer, jwks_uri: `${remoteIssuer}/jwks` })
        }
        throw new TypeError("network is unreachable")
      },
      { preconnect: originalFetch.preconnect },
    )
    try {
      const token = await tokenOf({ issuer: remoteIssuer })
      const env = environment({
        IDENTITY_JWKS: undefined,
        IDENTITY_ACCESS_TOKEN_ISSUER: remoteIssuer,
      })

      expect(await resolveSystemServiceBindingWhoami({ env }, { accessToken: token, now })).toEqual(
        unavailable,
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test("Identity bindingを読めないときはunavailableを返す", async () => {
    const empty = await createLocalD1Database({ schema: "CREATE TABLE unrelated (id TEXT);" })

    expect(
      await resolveSystemServiceBindingWhoami(
        { env: { ...environment(), DB: empty } },
        { accessToken: await tokenOf(), now },
      ),
    ).toEqual(unavailable)
  })
  test("受理した結果はAccount IDだけを持ち、structured cloneで渡せる", async () => {
    const result = await resolveSystemServiceBindingWhoami(
      { env: environment() },
      { accessToken: await tokenOf(), now },
    )

    expect(result).toEqual({ ok: true, account: { accountId: activeAccountId } })
    expect(structuredClone(result)).toEqual(result)
  })

  test("文字列でない、空、長すぎる入力は検証せずに拒否する", async () => {
    for (const accessToken of ["", "a".repeat(8_193), undefined, null, 42, { token: "x" }]) {
      expect(
        await resolveSystemServiceBindingWhoami({ env: environment() }, { accessToken, now }),
      ).toEqual(rejected)
    }
  })
})
