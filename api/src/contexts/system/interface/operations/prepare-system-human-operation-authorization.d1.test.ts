import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { prepareSystemHumanOperationAuthorization } from "@system/interface/operations/prepare-system-human-operation-authorization"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture() {
  const database = await createLocalD1Database({ schema: "" })
  for (const schema of ["system-core.sql", "system-integration.sql", "system-principal.sql"])
    await execSql(
      database,
      readFileSync(new URL(`../../infrastructure/schema/${schema}`, import.meta.url), "utf8"),
    )
  await execSql(
    database,
    `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
    VALUES ('55823b7f-711d-4dbd-af39-039ee6e1b4ff', 'active', 0, 100, 100);
    INSERT INTO system_principals (id, account_id, kind, name, revision, created_at, updated_at)
    VALUES ('308954f7-a233-4860-85cb-026577024347', '55823b7f-711d-4dbd-af39-039ee6e1b4ff', 'human', 'Operator', 1, 100, 100);
    INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
    VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'operator', 'custom', 'Operator', 100, 100);
    INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('4e74c1bb-6f90-452e-852b-b723b635cc75', 'records:write');
    INSERT INTO system_role_bindings (id, account_id, role_id, created_at)
    VALUES ('d50d88aa-2e8e-4e9b-8d15-2a1fb3ed6a4c', '55823b7f-711d-4dbd-af39-039ee6e1b4ff', '4e74c1bb-6f90-452e-852b-b723b635cc75', 100);`,
  )
  return { database }
}

test("呼び出し側が選んだ権限で判定し、保存時の照合文を返す", async () => {
  const { database } = await fixture()
  const input = {
    database,
    accountId: "55823b7f-711d-4dbd-af39-039ee6e1b4ff",
    tokenVersion: 0,
    now: new Date(1000),
  }
  const proof = await prepareSystemHumanOperationAuthorization({
    ...input,
    permissions: ["records:write"],
  })
  if (proof === "forbidden" || proof instanceof Error) throw new Error("authorization failed")
  expect(proof.principalId).toBe("308954f7-a233-4860-85cb-026577024347")
  await database.batch([...proof.assertions])
  expect(
    await prepareSystemHumanOperationAuthorization({ ...input, permissions: ["records:delete"] }),
  ).toBe("forbidden")
  await execSql(database, "UPDATE system_role_bindings SET revoked_at = 500")
  expect(await database.batch([...proof.assertions]).catch((cause) => cause)).toBeInstanceOf(Error)
})
