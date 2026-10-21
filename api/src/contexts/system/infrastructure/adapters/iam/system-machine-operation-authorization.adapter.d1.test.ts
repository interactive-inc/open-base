import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { zAccessTokenClaims } from "@system/domain/schemas/auth/access-token-claims.schema"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { SystemMachineOperationAuthorizationAdapter } from "@system/infrastructure/adapters/iam/system-machine-operation-authorization.adapter"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { execSql } from "@system/test/local-d1/exec-sql.test-support"

test("機械資格のtokenはsidとの併用を入口で拒否する", () => {
  const claims = {
    sub: "55823b7f-711d-4dbd-af39-039ee6e1b4ff",
    ver: 0,
    purpose: "api-session",
    iss: "system",
    aud: "system-api",
    jti: "machine-token",
    iat: 1,
    issuedAtMs: 1000,
    exp: 100,
    machineCredentialId: "610d1d94-a52a-4cb0-a0fb-78a6a301ef27",
  }
  expect(zAccessTokenClaims.safeParse(claims).success).toBe(true)
  expect(zAccessTokenClaims.safeParse({ ...claims, sid: "operator-family" }).success).toBe(false)
})

test("sidを持たない機械操作はSessionのlogout後も保存でき、機械資格の失効後は保存しない", async () => {
  const database = await createLocalD1Database({ schema: "" })
  for (const schema of ["system-core", "system-integration", "system-principal"])
    await execSql(
      database,
      readFileSync(new URL(`../../schema/${schema}.sql`, import.meta.url), "utf8"),
    )

  await execSql(
    database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
      VALUES ('55823b7f-711d-4dbd-af39-039ee6e1b4ff', 'active', 0, 100, 100);
    INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at)
      VALUES ('308954f7-a233-4860-85cb-026577024347', '55823b7f-711d-4dbd-af39-039ee6e1b4ff', 'service', 'Operator', 1, 100, 100);
    INSERT INTO system_machine_credentials (id, principal_id, name, secret_hash, status, created_at, updated_at, last_used_at)
      VALUES ('610d1d94-a52a-4cb0-a0fb-78a6a301ef27', '308954f7-a233-4860-85cb-026577024347', 'Primary', '${"1".repeat(64)}', 'active', 100, 1000, 1000);
    INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
      VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'custom:operator', 'custom', 'Operator', 100, 100);
    INSERT INTO system_iam_role_permissions (role_id, permission_key)
      VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'records:write');
    INSERT INTO system_role_bindings (id, account_id, role_id, created_at)
      VALUES ('d50d88aa-2e8e-4e9b-8d15-2a1fb3ed6a4c', '55823b7f-711d-4dbd-af39-039ee6e1b4ff', '4e74c1bb-6f90-452e-852b-b723b635cc75', 100);
    INSERT INTO system_sessions (id, account_id, family_id, token_hash, token_version, created_at, expires_at)
      VALUES ('449e3a89-ac7e-4a90-a083-36ce303735c0', '55823b7f-711d-4dbd-af39-039ee6e1b4ff', 'operator-family', '${"2".repeat(64)}', 0, 100, 10000);
    CREATE TABLE test_records (id TEXT PRIMARY KEY);`,
  )
  const adapter = new SystemMachineOperationAuthorizationAdapter({ env: { DB: database } })
  const input = {
    actor: {
      accountId: zAccountId.parse("55823b7f-711d-4dbd-af39-039ee6e1b4ff"),
      tokenVersion: 0,
      credentialId: "610d1d94-a52a-4cb0-a0fb-78a6a301ef27",
      issuedAtMs: 1000,
    },
    resource: { type: "records:entry", id: "record:1" },
    permissions: ["records:write"],
    now: new Date(1000),
  }
  const assertions = await adapter.prepare(input)
  if (assertions === "forbidden" || assertions instanceof Error)
    throw new Error("authorization failed", { cause: assertions })

  await execSql(database, "UPDATE system_sessions SET revoked_at = 1001")
  await database.batch([
    ...assertions,
    database.prepare("INSERT INTO test_records VALUES ('active')"),
    ...assertions,
  ])
  await execSql(
    database,
    "UPDATE system_machine_credentials SET status = 'revoked', revoked_at = 1001, updated_at = 1001",
  )
  expect(
    await database
      .batch([database.prepare("INSERT INTO test_records VALUES ('revoked')"), ...assertions])
      .catch((cause: unknown) => cause),
  ).toBeInstanceOf(Error)
  expect(await database.prepare("SELECT id FROM test_records").all()).toMatchObject({
    results: [{ id: "active" }],
  })
  expect(await adapter.prepare(input)).toBe("forbidden")
})
