import { testAccountId, testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import type { SystemDatabaseContext } from "@system/configuration/system-context"
import { SystemOidcIdentityAdapter } from "@system/infrastructure/adapters/identity/system-oidc-identity.adapter"
import * as schema from "@system/infrastructure/schema/system-core"
import { Database } from "bun:sqlite"
import { describe, expect, test } from "bun:test"
import { drizzle } from "drizzle-orm/bun-sqlite"
import type { DrizzleD1Database } from "drizzle-orm/d1"

const ACCOUNT_ID = testAccountId("account-1")
const IDENTITY_ID = testLiteralId("identity-1")

function createContext(): Readonly<{ context: SystemDatabaseContext; sqlite: Database }> {
  const sqlite = new Database(":memory:")
  sqlite.exec(`
    CREATE TABLE system_accounts (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      token_version INTEGER NOT NULL,
      closed_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE system_identity_bindings (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES system_accounts(id),
      provider TEXT NOT NULL,
      subject TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      activated_at INTEGER,
      revoked_at INTEGER
    );
    CREATE TABLE system_identity_profiles (
      identity_id TEXT PRIMARY KEY REFERENCES system_identity_bindings(id),
      email TEXT,
      email_verified INTEGER NOT NULL,
      last_used_at INTEGER,
      updated_at INTEGER NOT NULL
    );
  `)
  const database = drizzle(sqlite, { schema }) as unknown as DrizzleD1Database<typeof schema>

  return { context: { var: { database } }, sqlite }
}

describe("SystemOidcIdentityAdapter", () => {
  test("active Accountの確認済みIdentity profileをclaimへ復元する", async () => {
    const fixture = createContext()
    fixture.sqlite.exec(`
      INSERT INTO system_accounts VALUES ('${ACCOUNT_ID}', 'active', 0, NULL, 0, 0);
      INSERT INTO system_identity_bindings
        VALUES ('${IDENTITY_ID}', '${ACCOUNT_ID}', 'password', 'person@example.com', 0, 0, NULL);
      INSERT INTO system_identity_profiles
        VALUES ('${IDENTITY_ID}', 'person@example.com', 1, 10, 10);
    `)

    expect(
      await new SystemOidcIdentityAdapter(fixture.context).findByAccountId(
        zAccountId.parse(ACCOUNT_ID),
      ),
    ).toEqual({
      subject: ACCOUNT_ID,
      email: "person@example.com",
      emailVerified: true,
    })
    fixture.sqlite.close()
  })

  test("suspended AccountをOIDC identityとして返さない", async () => {
    const fixture = createContext()
    fixture.sqlite.exec(
      `INSERT INTO system_accounts VALUES ('${ACCOUNT_ID}', 'suspended', 1, NULL, 0, 1)`,
    )

    expect(
      await new SystemOidcIdentityAdapter(fixture.context).findByAccountId(
        zAccountId.parse(ACCOUNT_ID),
      ),
    ).toBeNull()
    fixture.sqlite.close()
  })
})
