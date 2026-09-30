import { systemPrincipalSchema } from "@system/infrastructure/schema/system-principal"
import { describe, expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/sqlite-core"

const RETAINED_MACHINE_ID = "a85ac8ae-2706-49ec-b35c-d3718a77bc20"

const coreSql = readFileSync(new URL("./system-core.sql", import.meta.url), "utf8")
const integrationSql = readFileSync(new URL("./system-integration.sql", import.meta.url), "utf8")
const principalSql = readFileSync(new URL("./system-principal.sql", import.meta.url), "utf8")

function createDatabase(): Database {
  const database = new Database(":memory:")
  database.exec("PRAGMA foreign_keys = ON")
  database.exec(coreSql)
  database.exec(integrationSql)
  database.exec(principalSql)
  return database
}

describe("System principal schema", () => {
  test("Drizzle宣言とcanonical DDLのtable・columnを一致させる", () => {
    const database = createDatabase()
    const tables = Object.values(systemPrincipalSchema)
      .map((table) => getTableConfig(table))
      .sort((left, right) => left.name.localeCompare(right.name))

    expect(tables.map((table) => table.name)).toEqual([
      "system_machine_credentials",
      "system_principals",
      "system_step_up_grants",
    ])
    for (const table of tables) {
      const columns = database
        .query<{ name: string }, []>(`PRAGMA table_info(${table.name})`)
        .all()
        .map((column) => column.name)
        .sort()
      expect(columns).toEqual(table.columns.map((column) => column.name).sort())
    }
    expect(database.query("PRAGMA foreign_key_check").all()).toEqual([])
  })

  test("人間へ機械credentialを発行せず、credentialとstep-upを削除不能にする", () => {
    const database = createDatabase()
    database.exec(
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES ('e6a43073-11e5-4a6a-970a-00d1517be641', 'active', 0, 1, 1), ('24bcd07d-9660-450b-9285-35ac93e4c27f', 'active', 0, 1, 1);
       INSERT INTO system_principals
         (id, account_id, kind, name, connector_id, revision, created_at, updated_at)
       VALUES
         ('44ce6e02-4a70-484d-ad0a-c525d6696568', 'e6a43073-11e5-4a6a-970a-00d1517be641', 'human', 'Human', NULL, 1, 1, 1),
         ('706562a0-8521-4b2d-81db-70207dd894b4', '24bcd07d-9660-450b-9285-35ac93e4c27f', 'service', 'Service', NULL, 1, 1, 1);
       INSERT INTO system_machine_credentials
         (id, principal_id, name, secret_hash, status, created_at, updated_at,
          expires_at, last_used_at, revoked_at)
       VALUES
         ('a85ac8ae-2706-49ec-b35c-d3718a77bc20', '706562a0-8521-4b2d-81db-70207dd894b4', 'Primary', '${"a".repeat(64)}',
          'active', 1, 1, NULL, NULL, NULL);
       INSERT INTO system_step_up_grants
         (id, account_id, token_hash, method, issued_at, expires_at, last_used_at, revoked_at)
       VALUES
         ('5e32da6a-cdd9-4fcf-b973-b80082165594', 'e6a43073-11e5-4a6a-970a-00d1517be641', '${"b".repeat(64)}', 'password', 1, 1000, NULL, NULL);`,
    )

    expect(() =>
      database.exec(
        `INSERT INTO system_machine_credentials
           (id, principal_id, name, secret_hash, status, created_at, updated_at,
            expires_at, last_used_at, revoked_at)
         VALUES ('c0f0895e-ff39-4a3d-a068-04920977e93b', '44ce6e02-4a70-484d-ad0a-c525d6696568', 'Invalid', '${"c".repeat(64)}',
           'active', 1, 1, NULL, NULL, NULL);`,
      ),
    ).toThrow("system_machine_credential_principal_invalid")
    expect(() =>
      database.exec(`DELETE FROM system_machine_credentials WHERE id = '${RETAINED_MACHINE_ID}'`),
    ).toThrow("system_machine_credentials_are_retained")
    expect(() =>
      database.exec(
        "DELETE FROM system_step_up_grants WHERE id = '5e32da6a-cdd9-4fcf-b973-b80082165594'",
      ),
    ).toThrow("system_step_up_grants_are_retained")
  })
})
