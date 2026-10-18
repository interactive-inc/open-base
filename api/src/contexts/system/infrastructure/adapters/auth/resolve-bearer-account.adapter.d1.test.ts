import { ResolveBearerAccountAdapter } from "@system/infrastructure/adapters/auth/resolve-bearer-account.adapter"
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

const issuer = "https://identity.example.com"
const apiAudience = "https://api.example.com"
const serviceBindingAudience = "urn:example:service-binding"
const accountId = "4f810255-55d5-43c8-b43f-2df5e7bf5a3c"
const profileClaims = { email: "you@example.com", email_verified: true, name: "Example User" }

let database: D1Database
let key: SystemIdentityTestKey

beforeAll(async () => {
  database = await createLocalD1Database()
  key = await createSystemIdentityTestKey("bearer-test-key")
  await execSql(
    database,
    `
    INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('${accountId}', 'active', 0, 0, 0);
    INSERT INTO system_identity_bindings
      (id, account_id, provider, subject, created_at, activated_at, revoked_at)
      VALUES ('b5d0c0c1-3f7e-4d8e-9a54-0c5c1f0e2a01', '${accountId}', 'oidc', 'subject-active', 0, 0, NULL);
  `,
  )
})

function adapter(overrides: Readonly<Record<string, string | undefined>> = {}) {
  return new ResolveBearerAccountAdapter({
    env: {
      DB: database,
      IDENTITY_ACCESS_TOKEN_ISSUER: issuer,
      IDENTITY_ACCESS_TOKEN_AUDIENCE: apiAudience,
      SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE: serviceBindingAudience,
      IDENTITY_JWKS: key.jwks,
      ...overrides,
    },
  })
}

function tokenOf(audience: string | ReadonlyArray<string>, now: Date): Promise<string> {
  return createSystemExternalAccessToken({
    signingKey: key.signingKey,
    keyId: key.keyId,
    now,
    subject: "subject-active",
    issuer,
    audience,
    claims: profileClaims,
  })
}

describe("ResolveBearerAccountAdapter with external access tokens", () => {
  test("HTTP APIのaudを持つtokenは、RPC入口のaudの有無にかかわらず受理する", async () => {
    const now = new Date()
    const token = await tokenOf(apiAudience, now)

    for (const overrides of [{}, { SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE: undefined }]) {
      expect(await adapter(overrides).resolve({ token, now })).toMatchObject({
        kind: "accepted",
        accountId,
      })
    }
  })

  test("RPC入口のaudを持つtokenはHTTP APIで拒否する", async () => {
    const now = new Date()

    for (const audience of [
      serviceBindingAudience,
      [apiAudience, serviceBindingAudience],
      [serviceBindingAudience, apiAudience],
    ]) {
      const token = await tokenOf(audience, now)
      expect(await adapter().resolve({ token, now })).toEqual({
        kind: "rejected",
        reason: "invalid token",
      })
    }
  })

  test("二つの入口のaudが同じ設定なら、HTTP APIでも外部access tokenを拒否する", async () => {
    const now = new Date()
    const token = await tokenOf(apiAudience, now)

    expect(
      await adapter({ SERVICE_BINDING_ACCESS_TOKEN_AUDIENCE: apiAudience }).resolve({ token, now }),
    ).toEqual({ kind: "rejected", reason: "invalid token" })
  })
})
