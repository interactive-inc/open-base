import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { testAccountId, testDerivedId } from "@system/test/system-test-id.test-support"
import { readFileSync } from "node:fs"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { zAccessTokenClaims } from "@system/domain/schemas/auth/access-token-claims.schema"
import { SystemPrincipalSecretService } from "@system/lib/auth/system-principal-secret-service"
import { SystemWorkAuthorizationAdapter } from "@system/infrastructure/adapters/work/system-work-authorization.adapter"
import { SystemWorkItemRepository } from "@system/infrastructure/repositories/work/system-work-item.repository"

/** 他のcontextと製品migrationを使わず、作業の権限・監査・証拠を検証する。 */
export async function createSystemWorkTestFixture() {
  const db = await createLocalD1Database({ schema: "" })
  for (const file of [
    "system-core",
    "system-integration",
    "system-principal",
    "system-attachment",
    "system-work-item",
  ])
    await execSql(
      db,
      readFileSync(new URL(`../infrastructure/schema/${file}.sql`, import.meta.url), "utf8"),
    )
  const clock = { now: new Date() }
  const issuedAt = clock.now.getTime() - 1000
  const stepUpToken =
    crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "")
  const stepUpTokens = new Map<string, string>()
  // Account は名前から決まる UUID で作り、呼び出し側は名前でも UUID でも指定できる。
  for (const account of ["owner", "worker", "recipient", "other", "admin"]) {
    const accountId = testAccountId(account)
    await db
      .prepare(
        "INSERT INTO system_accounts (id,status,token_version,created_at,updated_at) VALUES (?1,'active',0,100,100)",
      )
      .bind(accountId)
      .run()
    await db
      .prepare(
        "INSERT INTO system_principals (id,account_id,kind,name,revision,created_at,updated_at) VALUES (?1,?2,?3,'Test operator',1,100,100)",
      )
      .bind(
        testDerivedId("principal", account),
        accountId,
        account === "worker" ? "agent" : "human",
      )
      .run()
    // role と割当の主キーは UUID。role は key の `role:<account>` で引ける。
    const roleId = crypto.randomUUID()
    await db
      .prepare(
        "INSERT INTO system_iam_roles (id,key,kind,name,created_at,updated_at) VALUES (?1,?2,'custom','Test role',100,100)",
      )
      .bind(roleId, `role:${account}`)
      .run()
    for (const permission of account === "admin"
      ? ["system:admin"]
      : [
          "system:work:read",
          "system:work:create",
          "system:work:perform",
          "system:work:review",
          "system:work:manage",
        ])
      await db
        .prepare("INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1,?2)")
        .bind(roleId, permission)
        .run()
    await db
      .prepare(
        "INSERT INTO system_role_bindings (id,account_id,role_id,created_at) VALUES (?1,?2,?3,100)",
      )
      .bind(crypto.randomUUID(), accountId, roleId)
      .run()
    if (account !== "worker") {
      const raw = await new SystemPrincipalSecretService().hashRawSecret(`${stepUpToken}${account}`)
      if (raw instanceof Error) throw raw
      stepUpTokens.set(accountId, raw)
      const hash = await new SystemPrincipalSecretService().hashRawSecret(raw)
      if (hash instanceof Error) throw hash
      await db
        .prepare(`INSERT INTO system_step_up_grants (id,account_id,token_hash,method,issued_at,expires_at,last_used_at)
        VALUES (?1,?2,?3,'password',?4,?5,?4)`)
        .bind(testDerivedId("step-up", account), accountId, hash, issuedAt, issuedAt + 300000)
        .run()
    }
  }
  await db
    .prepare(`INSERT INTO system_machine_credentials (id,principal_id,name,secret_hash,status,created_at,updated_at,last_used_at)
    VALUES ('087f472e-41a4-42b5-a66f-c625597754b0','ef083a4f-dd0a-42a8-8007-57ab6f2df095','Test credential',?1,'active',100,?2,?2)`)
    .bind("a".repeat(64), issuedAt)
    .run()
  function claims(account: string) {
    return zAccessTokenClaims.parse({
      sub: testAccountId(account),
      ver: 0,
      purpose: "api-session",
      iss: "test",
      aud: "test",
      jti: crypto.randomUUID(),
      iat: Math.floor(issuedAt / 1000),
      issuedAtMs: issuedAt,
      exp: Math.floor(issuedAt / 1000) + 3600,
      ...(testAccountId(account) === testAccountId("worker")
        ? { machineCredentialId: "087f472e-41a4-42b5-a66f-c625597754b0" }
        : {}),
    })
  }
  function adapter(account: string, identityBindingId: string | null = null) {
    return new SystemWorkAuthorizationAdapter({
      env: { DB: db },
      var: { now: () => clock.now },
      authentication: {
        accountId: claims(account).sub,
        tokenVersion: claims(account).ver,
        issuedAtMs: claims(account).issuedAtMs,
        expiresAtMs: claims(account).exp * 1000,
        machineCredentialId: claims(account).machineCredentialId ?? null,
        identityBindingId,
      },
    })
  }
  async function authorized(
    account: string,
    permission = "system:work:read",
    protectedOperation = false,
  ) {
    const authorization = await adapter(account).prepare({
      permission,
      stepUpToken: protectedOperation ? (stepUpTokens.get(testAccountId(account)) ?? "") : null,
    })
    if (authorization instanceof Error) throw authorization
    return {
      authorization,
      repository: new SystemWorkItemRepository({ env: { DB: db }, authorization }),
    }
  }
  return { db, clock, claims, adapter, authorized, stepUpTokens }
}
