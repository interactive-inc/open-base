import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemMachineCredentialRepository } from "@system/infrastructure/repositories/iam/system-machine-credential.repository"
import { SystemAccessTokenIssuer } from "@system/lib/auth/system-access-token-issuer"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { POST } from "@system/interface/routes/system.machine-sessions"
import { GET } from "@system/interface/routes/system.principals"
import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { decodeJwt } from "jose"
import { z } from "zod"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const secret = "machine-session-test-signing-secret"
const rawCredential = "1".repeat(64)

async function createFixture(kind: "agent" | "service" | "connector" = "service") {
  const fixture = await SystemSessionTestContext.create()
  const clock = { at: new Date() }
  const createdAt = clock.at.getTime() - 1_000
  const expiresAt = clock.at.getTime() + 60_000
  const hash = await new SystemPrincipalSecretService().hashRawSecret(rawCredential)
  if (hash instanceof Error) throw hash
  await fixture.database
    .prepare(`INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES ('13943a8c-a101-4ba6-82d3-560dfa60c19b', 'active', 0, ?1, ?1)`)
    .bind(createdAt)
    .run()
  if (kind === "connector") {
    await fixture.database
      .prepare(`INSERT INTO system_connectors
         (id, key, name, direction, transport, status, revision, created_at, updated_at)
         VALUES ('connector-1', 'inbound-test', 'Inbound', 'inbound', 'api', 'active', 1, ?1, ?1)`)
      .bind(createdAt)
      .run()
  }
  await fixture.database
    .prepare(`INSERT INTO system_principals
       (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
       VALUES ('9a98bc39-03b1-4115-9d64-7bd9817b3a8d', '13943a8c-a101-4ba6-82d3-560dfa60c19b', ?1, 'Automation', ?2, 1, ?3, ?3)`)
    .bind(kind, kind === "connector" ? "connector-1" : null, createdAt)
    .run()
  await fixture.database
    .prepare(`INSERT INTO system_machine_credentials
       (id, principal_id, name, secret_hash, status, created_at, updated_at, expires_at)
       VALUES ('ad6a0f96-902f-4999-84f6-2b9eb703c2ed', '9a98bc39-03b1-4115-9d64-7bd9817b3a8d', 'Primary', ?1, 'active', ?2, ?2, ?3)`)
    .bind(hash, createdAt, expiresAt)
    .run()
  await execSql(
    fixture.database,
    `
    INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
    VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2', 'system:reader', 'custom', 'Reader', 1, 1);
    INSERT INTO system_iam_role_permissions (role_id, permission_key)
    VALUES ('04635707-bd54-47ea-81d4-38426e3ce8a2', 'iam:read');
    INSERT INTO system_role_bindings
    (id, account_id, role_id, created_at, revoked_at)
    VALUES ('72da13a4-abc7-476f-8499-074d4f8a8854', '13943a8c-a101-4ba6-82d3-560dfa60c19b', '04635707-bd54-47ea-81d4-38426e3ce8a2', 1, NULL);
  `,
  )
  const app = systemFactory.createApp()
  app.use("*", async (context, next) => {
    context.set("now", () => clock.at)
    await next()
  })
  const routes = app.post("/system/machine-sessions", ...POST).get("/system/principals", ...GET)
  const request = (path: string, init?: RequestInit) =>
    routes.request(path, init, {
      DB: fixture.context.env.DB,
      JWT_SECRET: secret,
      NOW: clock.at.toISOString(),
    })
  const issue = (
    credentialId = "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
    credentialSecret = rawCredential,
  ) =>
    request("/system/machine-sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential_id: credentialId, secret: credentialSecret }),
    })
  const read = (token: string) =>
    request("/system/principals", { headers: { authorization: `Bearer ${token}` } })
  return { fixture, clock, hash, issue, read }
}

async function issuedToken(response: Response): Promise<string> {
  expect(response.status).toBe(201)
  return z.object({ access_token: z.string() }).parse(await response.json()).access_token
}

describe("System machine access token", () => {
  test("一つのcredentialの失効で同じAccountの別credentialまで失効させない", async () => {
    const context = await createFixture()
    const firstToken = await issuedToken(await context.issue())
    const secondSecret = "2".repeat(64)
    const secondHash = await new SystemPrincipalSecretService().hashRawSecret(secondSecret)
    if (secondHash instanceof Error) throw secondHash
    await context.fixture.database
      .prepare(`INSERT INTO system_machine_credentials
      (id, principal_id, name, secret_hash, status, created_at, updated_at)
      VALUES ('64571a17-dadf-476c-b4ab-d793d738ef0c', '9a98bc39-03b1-4115-9d64-7bd9817b3a8d', 'Secondary', ?1, 'active', ?2, ?2)`)
      .bind(secondHash, context.clock.at.getTime())
      .run()
    const secondToken = await issuedToken(
      await context.issue("64571a17-dadf-476c-b4ab-d793d738ef0c", secondSecret),
    )
    expect((await context.read(firstToken)).status).toBe(200)
    expect((await context.read(secondToken)).status).toBe(200)
    expect(
      await new SystemMachineCredentialRepository(context.fixture.context).revoke(
        "9a98bc39-03b1-4115-9d64-7bd9817b3a8d",
        "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
        context.clock.at,
        [],
      ),
    ).toBe("revoked")
    expect((await context.read(firstToken)).status).toBe(401)
    expect((await context.read(secondToken)).status).toBe(200)
  })

  test.each(["agent", "service", "connector"] satisfies Array<"agent" | "service" | "connector">)(
    "%sの発行元credentialをtokenへ保持し、失効後は発行済みtokenも拒否する",
    async (kind) => {
      const context = await createFixture(kind)
      const token = await issuedToken(await context.issue())
      expect(decodeJwt(token).machineCredentialId).toBe("ad6a0f96-902f-4999-84f6-2b9eb703c2ed")
      expect((await context.read(token)).status).toBe(200)
      expect(
        await new SystemMachineCredentialRepository(context.fixture.context).revoke(
          "9a98bc39-03b1-4115-9d64-7bd9817b3a8d",
          "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
          context.clock.at,
          [],
        ),
      ).toBe("revoked")
      expect((await context.read(token)).status).toBe(401)
      expect((await context.issue()).status).toBe(401)
    },
  )

  test("credentialの期限到達でJWTの期限内でも利用できなくなる", async () => {
    const context = await createFixture()
    const token = await issuedToken(await context.issue())
    context.clock.at = new Date(context.clock.at.getTime() + 59_999)
    expect((await context.read(token)).status).toBe(200)
    context.clock.at = new Date(context.clock.at.getTime() + 1)
    expect((await context.read(token)).status).toBe(401)
  })

  test.each(["suspend", "version", "connector"])(
    "%sの変更を発行済みtokenと次のtoken発行の両方へ反映する",
    async (change) => {
      const context = await createFixture("connector")
      const token = await issuedToken(await context.issue())
      expect((await context.read(token)).status).toBe(200)
      if (change === "suspend") {
        await execSql(context.fixture.database, "UPDATE system_accounts SET status = 'suspended'")
      } else if (change === "version") {
        await execSql(
          context.fixture.database,
          "UPDATE system_accounts SET token_version = token_version + 1",
        )
      } else {
        await execSql(
          context.fixture.database,
          "UPDATE system_connectors SET status = 'disabled', revision = revision + 1",
        )
      }
      expect((await context.read(token)).status).toBe(401)
      expect((await context.issue()).status).toBe(change === "version" ? 201 : 401)
    },
  )

  test("発行元のない旧機械tokenと別credentialを指定したtokenを拒否する", async () => {
    const context = await createFixture()
    await issuedToken(await context.issue())
    for (const machineCredentialId of [undefined, "unknown-credential"]) {
      const token = await new SystemAccessTokenIssuer(secret).issue({
        accountId: zAccountId.parse("13943a8c-a101-4ba6-82d3-560dfa60c19b"),
        tokenVersion: 0,
        machineCredentialId,
        now: context.clock.at,
      })
      expect(token).not.toBeInstanceOf(Error)
      if (token instanceof Error) throw token
      expect((await context.read(token)).status).toBe(401)
    }
  })

  test("機械tokenでも権限が失効した後は操作を許可しない", async () => {
    const context = await createFixture()
    const token = await issuedToken(await context.issue())
    expect((await context.read(token)).status).toBe(200)
    await execSql(context.fixture.database, "DELETE FROM system_iam_role_permissions")
    expect((await context.read(token)).status).toBe(403)
  })

  test.each(["suspend", "version", "connector"])(
    "認証読取と確定の間の%s変更で使用記録と監査を確定しない",
    async (change) => {
      const context = await createFixture("connector")
      const database = context.fixture.database
      const changeSql =
        change === "suspend"
          ? "UPDATE system_accounts SET status = 'suspended'"
          : change === "version"
            ? "UPDATE system_accounts SET token_version = token_version + 1"
            : "UPDATE system_connectors SET status = 'disabled', revision = revision + 1"
      // 認証の読取後、確定のbatchを送る直前に別の書き込みを割り込ませる。
      const interleaved = new Proxy(database, {
        get(target, property) {
          if (property === "batch")
            return async (statements: Array<D1PreparedStatement>) => {
              await execSql(database, changeSql)
              return database.batch(statements)
            }
          const value: unknown = Reflect.get(target, property, target)
          return typeof value === "function" ? value.bind(target) : value
        },
      })
      const result = await new SystemMachineCredentialRepository({
        ...context.fixture.context,
        env: { ...context.fixture.context.env, DB: interleaved },
      }).authenticate(
        "ad6a0f96-902f-4999-84f6-2b9eb703c2ed",
        context.hash,
        context.clock.at,
        () => [
          database.prepare(
            `INSERT INTO system_audit_events
           (event_id, action, target_type, outcome, occurred_at)
           VALUES ('must-not-commit', 'auth.machine_token.issued', 'credential', 'succeeded', 1)`,
          ),
        ],
      )
      expect(result).toEqual({ kind: "rejected" })
      expect(
        await context.fixture.database
          .prepare("SELECT last_used_at FROM system_machine_credentials")
          .first<Record<string, unknown>>(),
      ).toEqual({ last_used_at: null })
      expect(
        await context.fixture.database
          .prepare("SELECT count(*) AS total FROM system_audit_events")
          .first<Record<string, unknown>>(),
      ).toEqual({ total: 0 })
    },
  )
})
