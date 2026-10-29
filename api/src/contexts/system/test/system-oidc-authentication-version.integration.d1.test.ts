import { exportJWK, generateKeyPair } from "jose"
import { ExchangeOidcAuthorizationCode } from "@system/application/auth/exchange-oidc-authorization-code"
import { ApproveOidcAuthorization } from "@system/application/auth/approve-oidc-authorization"
import { OidcClientRegistryValue } from "@system/domain/values/oauth/oidc-client-registry.value"
import { SystemOidcIdentityAdapter } from "@system/infrastructure/adapters/identity/system-oidc-identity.adapter"
import { SYSTEM_AUDIT_ACTIONS } from "@system/domain/catalogs/audit/system-audit-action.catalog"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { drizzle } from "drizzle-orm/d1"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { systemCoreSchema } from "@system/infrastructure/schema/system-core"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CreateOidcAuthorizationCodeAdapter } from "@system/infrastructure/adapters/identity/create-oidc-authorization-code.adapter"
import { ConsumeOidcAuthorizationCodeAdapter } from "@system/infrastructure/adapters/identity/consume-oidc-authorization-code.adapter"
import { CreateOidcAccessTokenAdapter } from "@system/infrastructure/adapters/identity/create-oidc-access-token.adapter"
import { FindOidcAccessTokenAdapter } from "@system/infrastructure/adapters/identity/find-oidc-access-token.adapter"
import { toPkceS256Challenge } from "@system/lib/auth/to-pkce-s256-challenge"
import { OidcIssuerConfigurationValue } from "@system/domain/values/oauth/oidc-issuer-configuration.value"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { GET as USERINFO } from "@system/interface/routes/system.oauth.userinfo"

setDefaultTimeout(30_000)
const accountId = zAccountId.parse("fcd3b186-db56-4b04-8df7-acf9afd0c292")
const now = new Date("2030-01-01T00:00:00Z")
const issuer = "https://identity.example.test"
const verifier = "v".repeat(43)
async function fixture() {
  const db = await createLocalD1Database({
    schema: readFileSync(
      new URL("../infrastructure/schema/system-core.sql", import.meta.url),
      "utf8",
    ),
  })
  await db
    .prepare(
      "INSERT INTO system_accounts(id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,0,0)",
    )
    .bind(accountId)
    .run()
  const database = drizzle(db, { schema: systemCoreSchema })
  const context = { env: { DB: db }, var: { database, now: () => now } }
  const app = systemFactory
    .createApp()
    .use("*", async (c, next) => {
      c.set("database", database)
      c.set("now", () => now)
      c.set(
        "oidcIssuerConfiguration",
        new OidcIssuerConfigurationValue({
          issuersByHostname: { "identity.example.test": issuer },
          localProxyHostnames: [],
          localIssuerHostname: null,
        }),
      )
      await next()
    })
    .get("/system/oauth/userinfo", ...USERINFO)
  return {
    db,
    context,
    bump: () =>
      db
        .prepare(
          "UPDATE system_accounts SET token_version=token_version+1,updated_at=?1 WHERE id=?2",
        )
        .bind(now.getTime(), accountId)
        .run(),
    userinfo: (token: string) =>
      app.request(
        issuer + "/system/oauth/userinfo",
        { headers: { authorization: `Bearer ${token}` } },
        { DB: db },
      ),
  }
}

test("OIDC codeは認証版更新後に交換できない", async () => {
  const f = await fixture()
  const created = await new CreateOidcAuthorizationCodeAdapter(
    f.context,
  ).createOidcAuthorizationCode({
    issuer,
    clientId: "example-client",
    redirectUri: "https://client.example.com/callback",
    accountId,
    tokenVersion: 0,
    codeChallenge: await toPkceS256Challenge(verifier),
    nonce: "example-nonce",
    scope: ["openid"],
  })
  if (created instanceof Error) throw created
  await f.bump()
  expect(
    await new ConsumeOidcAuthorizationCodeAdapter(f.context).consumeOidcAuthorizationCode({
      issuer,
      clientId: "example-client",
      redirectUri: "https://client.example.com/callback",
      code: created.code,
      verifier,
    }),
  ).toBeNull()
})
test("OIDC access tokenは認証版更新後に解決できない", async () => {
  const f = await fixture()
  const created = await new CreateOidcAccessTokenAdapter(f.context).createOidcAccessToken({
    issuer,
    clientId: "example-client",
    accountId,
    tokenVersion: 0,
    scope: "openid",
  })
  if (created instanceof Error) throw created
  await f.bump()
  expect(
    await new FindOidcAccessTokenAdapter(f.context).findOidcAccessToken({
      issuer,
      accessToken: created.accessToken,
    }),
  ).toBeNull()
})
test("UserInfo HTTPは認証版更新後のtokenへclaimを開示しない", async () => {
  const f = await fixture()
  const created = await new CreateOidcAccessTokenAdapter(f.context).createOidcAccessToken({
    issuer,
    clientId: "example-client",
    accountId,
    tokenVersion: 0,
    scope: "openid",
  })
  if (created instanceof Error) throw created
  await f.bump()
  const response = await f.userinfo(created.accessToken)
  expect(response.status).toBe(401)
  expect(await response.text()).not.toContain(accountId)
})

type Fixture = Awaited<ReturnType<typeof fixture>>
const redirectUri = "https://client.example.com/callback"
const clientId = "example-client"
function access(f: Fixture, tokenVersion = 0, issuedAt = now) {
  return new CreateOidcAccessTokenAdapter({
    ...f.context,
    var: { ...f.context.var, now: () => issuedAt },
  }).createOidcAccessToken({ issuer, clientId, accountId, tokenVersion, scope: "openid" })
}
async function code(f: Fixture, tokenVersion = 0, issuedAt = now) {
  return new CreateOidcAuthorizationCodeAdapter({
    ...f.context,
    var: { ...f.context.var, now: () => issuedAt },
  }).createOidcAuthorizationCode({
    issuer,
    clientId,
    redirectUri,
    accountId,
    tokenVersion,
    codeChallenge: await toPkceS256Challenge(verifier),
    nonce: "example-nonce",
    scope: ["openid"],
  })
}
function registry() {
  const value = OidcClientRegistryValue.restore({
    [issuer]: [{ id: clientId, name: "Example", redirectUris: [redirectUri] }],
  })
  if (value instanceof Error) throw value
  return value
}
async function signingKeys() {
  const pair = await generateKeyPair("ES256", { extractable: true })
  const key = await exportJWK(pair.privateKey)
  return JSON.stringify({
    active: { ...key, kid: "example-key", use: "sig", alg: "ES256" },
    previous: [],
  })
}

test("現在の非zero版はOIDC codeとUserInfo tokenで維持される", async () => {
  const f = await fixture()
  await f.bump()
  const issued = await code(f, 1)
  if (issued instanceof Error) throw issued
  const consumed = await new ConsumeOidcAuthorizationCodeAdapter(
    f.context,
  ).consumeOidcAuthorizationCode({ issuer, clientId, redirectUri, code: issued.code, verifier })
  expect(consumed).toMatchObject({ accountId, tokenVersion: 1 })
  expect(
    await new ConsumeOidcAuthorizationCodeAdapter(f.context).consumeOidcAuthorizationCode({
      issuer,
      clientId,
      redirectUri,
      code: issued.code,
      verifier,
    }),
  ).toBeNull()
  const token = await access(f, 1)
  if (token instanceof Error) throw token
  expect((await f.userinfo(token.accessToken)).status).toBe(200)
})
for (const resource of ["code", "token"]) {
  test(`${resource}は発行直前の版変更で保存されない`, async () => {
    const f = await fixture()
    await f.bump()
    expect(await (resource === "code" ? code(f) : access(f))).toBeInstanceOf(Error)
    expect(
      await f.db
        .prepare(
          "SELECT (SELECT count(*) FROM system_oidc_authorization_codes)+(SELECT count(*) FROM system_oidc_access_tokens) AS count",
        )
        .first<number>("count"),
    ).toBe(0)
  })
  test(`${resource}は有効期間の開始前に使えない`, async () => {
    const f = await fixture()
    if (resource === "code") {
      const issued = await code(f, 0, new Date(now.getTime() + 1000))
      if (issued instanceof Error) throw issued
      expect(
        await new ConsumeOidcAuthorizationCodeAdapter(f.context).consumeOidcAuthorizationCode({
          issuer,
          clientId,
          redirectUri,
          code: issued.code,
          verifier,
        }),
      ).toBeNull()
    } else {
      const token = await access(f, 0, new Date(now.getTime() + 1000))
      if (token instanceof Error) throw token
      expect((await f.userinfo(token.accessToken)).status).toBe(401)
    }
  })
}
test("UserInfoはIdentity読取中の失効も開示前に検出する", async () => {
  const f = await fixture()
  const issued = await access(f)
  if (issued instanceof Error) throw issued
  const original = new SystemOidcIdentityAdapter(f.context).findByAccountId.bind(
    new SystemOidcIdentityAdapter(f.context),
  )
  const spy = spyOn(SystemOidcIdentityAdapter.prototype, "findByAccountId").mockImplementation(
    async (...args) => {
      const identity = await original(...args)
      await f.bump()
      return identity
    },
  )
  try {
    const response = await f.userinfo(issued.accessToken)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(401)
    expect(await response.text()).not.toContain(accountId)
  } finally {
    spy.mockRestore()
  }
})
for (const stage of ["consume", "store"]) {
  test(`code交換は${stage}後の失効でtoken応答と成功監査を返さない`, async () => {
    const f = await fixture()
    const issued = await code(f)
    if (issued instanceof Error) throw issued
    const context = {
      ...f.context,
      env: { ...f.context.env, OIDC_SIGNING_KEYS: await signingKeys() },
    }
    const consume = new ConsumeOidcAuthorizationCodeAdapter(
      f.context,
    ).consumeOidcAuthorizationCode.bind(new ConsumeOidcAuthorizationCodeAdapter(f.context))
    const create = new CreateOidcAccessTokenAdapter(f.context).createOidcAccessToken.bind(
      new CreateOidcAccessTokenAdapter(f.context),
    )
    const spy =
      stage === "consume"
        ? spyOn(
            ConsumeOidcAuthorizationCodeAdapter.prototype,
            "consumeOidcAuthorizationCode",
          ).mockImplementation(async (...args) => {
            const result = await consume(...args)
            await f.bump()
            return result
          })
        : spyOn(CreateOidcAccessTokenAdapter.prototype, "createOidcAccessToken").mockImplementation(
            async (...args) => {
              const result = await create(...args)
              await f.bump()
              return result
            },
          )
    try {
      const result = await new ExchangeOidcAuthorizationCode(context).execute({
        issuer,
        clientId,
        redirectUri,
        code: issued.code,
        codeVerifier: verifier,
        clientRegistry: registry(),
      })
      expect(result).toBeInstanceOf(Error)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(
        await f.db
          .prepare(
            "SELECT count(*) AS count FROM system_audit_events WHERE action=?1 AND outcome='succeeded'",
          )
          .bind(SYSTEM_AUDIT_ACTIONS.authOidcTokenExchange)
          .first<number>("count"),
      ).toBe(0)
    } finally {
      spy.mockRestore()
    }
  })
}
test("認可code発行中の失効では成功redirectと監査を返さない", async () => {
  const f = await fixture()
  const original = new CreateOidcAuthorizationCodeAdapter(
    f.context,
  ).createOidcAuthorizationCode.bind(new CreateOidcAuthorizationCodeAdapter(f.context))
  const spy = spyOn(
    CreateOidcAuthorizationCodeAdapter.prototype,
    "createOidcAuthorizationCode",
  ).mockImplementation(async (...args) => {
    const result = await original(...args)
    await f.bump()
    return result
  })
  try {
    const result = await new ApproveOidcAuthorization({
      ...f.context,
      var: {
        ...f.context.var,
        userId: accountId,
        accountTokenVersion: 0,
        role: "authenticated",
        permissions: new Set<string>(),
      },
    }).execute({
      issuer,
      clientId,
      redirectUri,
      scope: "openid",
      state: "example-state",
      nonce: "example-nonce",
      codeChallenge: await toPkceS256Challenge(verifier),
      clientRegistry: registry(),
    })
    expect(result).toBeInstanceOf(Error)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(
      await f.db
        .prepare("SELECT count(*) AS count FROM system_audit_events WHERE outcome='succeeded'")
        .first<number>("count"),
    ).toBe(0)
  } finally {
    spy.mockRestore()
  }
})
