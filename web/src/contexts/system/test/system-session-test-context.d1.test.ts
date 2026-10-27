import { SystemSessionTestContext } from "@system/test/system-session-test-context.test-support"
import { testAccountId, testDerivedId } from "@system/test/system-test-id.test-support"
import { Database } from "bun:sqlite"
import { describe, expect, setDefaultTimeout, test } from "bun:test"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

/**
 * test contextが正本のschemaそのものであることを固定する。
 * 認証・IAMのtestは、ここで確かめる制約が効いているDBの上でだけ本番の挙動を検証できる。
 */

const accountId = testAccountId("context-account")
const roleId = testDerivedId("role", "context-member")

async function createFixture(): Promise<SystemSessionTestContext> {
  const fixture = await SystemSessionTestContext.create()
  await fixture.database
    .prepare(
      "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES (?1, 'active', 0, 100, 100)",
    )
    .bind(accountId)
    .run()
  await fixture.database
    .prepare(
      "INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES (?1, 'example:member', 'custom', 'Member', 100, 100)",
    )
    .bind(roleId)
    .run()
  return fixture
}

function insertIdentity(
  fixture: SystemSessionTestContext,
  input: Readonly<{
    id: string
    provider: string
    subject: string
    createdAt?: number
    activatedAt?: number | null
    revokedAt?: number | null
  }>,
) {
  return fixture.database
    .prepare(
      `INSERT INTO system_identity_bindings
         (id, account_id, provider, subject, created_at, activated_at, revoked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
    )
    .bind(
      input.id,
      accountId,
      input.provider,
      input.subject,
      input.createdAt ?? 100,
      input.activatedAt ?? null,
      input.revokedAt ?? null,
    )
    .run()
}

function insertBinding(
  fixture: SystemSessionTestContext,
  input: Readonly<{ id: string; roleId?: string; resource?: Readonly<[string, string]> }>,
) {
  return fixture.database
    .prepare(
      `INSERT INTO system_role_bindings
         (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 100, NULL)`,
    )
    .bind(
      input.id,
      accountId,
      input.roleId ?? roleId,
      input.resource?.[0] ?? null,
      input.resource?.[1] ?? null,
    )
    .run()
}

function insertCredential(
  fixture: SystemSessionTestContext,
  input: Readonly<{ identityId: string; changedAt: number; createdAt: number; updatedAt: number }>,
) {
  return fixture.database
    .prepare(
      `INSERT INTO system_password_credentials
         (identity_id, password_hash, changed_at, created_at, updated_at)
       VALUES (?1, 'password-hash-placeholder', ?2, ?3, ?4)`,
    )
    .bind(input.identityId, input.changedAt, input.createdAt, input.updatedAt)
    .run()
}

/** 閉じたAccountは、停止・token_versionの前進・時刻の一致を1文で満たしたときだけ作れる。 */
function closeAccount(fixture: SystemSessionTestContext) {
  return fixture.database
    .prepare(
      `UPDATE system_accounts
       SET status = 'suspended', token_version = token_version + 1, closed_at = 200, updated_at = 200
       WHERE id = ?1`,
    )
    .bind(accountId)
    .run()
}

function readAccount(fixture: SystemSessionTestContext) {
  return fixture.database
    .prepare(
      "SELECT status, token_version AS tokenVersion, closed_at AS closedAt FROM system_accounts WHERE id = ?1",
    )
    .bind(accountId)
    .first<Record<string, unknown>>()
}

type SchemaObject = Readonly<{ type: string; name: string; table: string }>

const schemaObjectsSql = `SELECT type, name, tbl_name AS "table" FROM sqlite_master
  WHERE type IN ('table', 'index', 'trigger')
    AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%'
  ORDER BY type, name`

describe("SystemSessionTestContextのschema", () => {
  test("正本のschemaが作るtable・index・triggerを一つも落とさずに持つ", async () => {
    const fixture = await SystemSessionTestContext.create()
    const canonical = new Database(":memory:")
    try {
      canonical.exec(SystemSessionTestContext.schema)
      const expected = canonical.query<SchemaObject, []>(schemaObjectsSql).all()
      const actual = (await fixture.database.prepare(schemaObjectsSql).all<SchemaObject>()).results

      expect(actual).toEqual(expected)
      expect(expected.filter((object) => object.type === "trigger").length).toBeGreaterThan(0)
    } finally {
      canonical.close()
    }
  })

  test("認証・IAMのidはUUIDだけを受け入れ、参照先のない割当を拒否する", async () => {
    const fixture = await createFixture()

    await expect(
      insertIdentity(fixture, {
        id: "identity-root",
        provider: "password",
        subject: "a@b.example",
      }),
    ).rejects.toThrow("CHECK constraint failed")
    await expect(insertBinding(fixture, { id: "binding-root" })).rejects.toThrow(
      "CHECK constraint failed",
    )
    await expect(
      insertBinding(fixture, {
        id: testDerivedId("role-binding", "missing-role"),
        roleId: testDerivedId("role", "missing"),
      }),
    ).rejects.toThrow("FOREIGN KEY constraint failed")
  })

  test("同じAccount・ロール・資源のactiveな割当を重複させない", async () => {
    const fixture = await createFixture()
    await insertBinding(fixture, { id: testDerivedId("role-binding", "global-1") })
    await insertBinding(fixture, {
      id: testDerivedId("role-binding", "scoped-1"),
      resource: ["example:resource", "r1"],
    })

    await expect(
      insertBinding(fixture, { id: testDerivedId("role-binding", "global-2") }),
    ).rejects.toThrow("UNIQUE constraint failed")
    await expect(
      insertBinding(fixture, {
        id: testDerivedId("role-binding", "scoped-2"),
        resource: ["example:resource", "r1"],
      }),
    ).rejects.toThrow("UNIQUE constraint failed")

    // 失効した割当は一意性の対象から外れ、同じ組をもう一度割り当てられる。
    await fixture.database
      .prepare("UPDATE system_role_bindings SET revoked_at = 150 WHERE id = ?1")
      .bind(testDerivedId("role-binding", "global-1"))
      .run()
    await insertBinding(fixture, { id: testDerivedId("role-binding", "global-2") })
    expect(
      await fixture.database
        .prepare(
          "SELECT count(*) AS total FROM system_role_bindings WHERE resource_type IS NULL AND revoked_at IS NULL",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 1 })
  })

  test("閉じたAccountへIdentity・割当・Sessionを足せない", async () => {
    const fixture = await createFixture()
    await closeAccount(fixture)
    expect(await readAccount(fixture)).toEqual({
      status: "suspended",
      tokenVersion: 1,
      closedAt: 200,
    })

    await expect(
      insertIdentity(fixture, {
        id: testDerivedId("identity", "closed"),
        provider: "password",
        subject: "closed@example.com",
        createdAt: 300,
      }),
    ).rejects.toThrow("closed account cannot receive an identity")
    await expect(
      insertBinding(fixture, { id: testDerivedId("role-binding", "closed") }),
    ).rejects.toThrow("closed account cannot receive a role binding")
    await expect(
      fixture.database
        .prepare(
          `INSERT INTO system_sessions
             (id, account_id, family_id, token_hash, token_version, created_at, expires_at)
           VALUES (?1, ?2, ?1, ?3, 1, 300, 400)`,
        )
        .bind(testDerivedId("session", "closed"), accountId, "0".repeat(64))
        .run(),
    ).rejects.toThrow("closed account cannot receive a session")
  })

  test("Accountの状態変更はtoken_versionを同時に1つ進めたときだけ通る", async () => {
    const fixture = await createFixture()
    const update = (assignments: string) =>
      fixture.database
        .prepare(`UPDATE system_accounts SET ${assignments} WHERE id = ?1`)
        .bind(accountId)
        .run()

    await expect(update("status = 'suspended'")).rejects.toThrow(
      "account security state is not monotonic",
    )
    await expect(update("status = 'suspended', token_version = token_version + 2")).rejects.toThrow(
      "account security state is not monotonic",
    )
    expect(await readAccount(fixture)).toEqual({
      status: "active",
      tokenVersion: 0,
      closedAt: null,
    })

    await update("status = 'suspended', token_version = token_version + 1")
    expect(await readAccount(fixture)).toEqual({
      status: "suspended",
      tokenVersion: 1,
      closedAt: null,
    })
    await expect(update("token_version = token_version - 1")).rejects.toThrow(
      "account security state is not monotonic",
    )

    // 閉じるときも停止とtoken_versionの前進を伴い、閉じた後は何も変えられない。
    await update("status = 'active', token_version = token_version + 1")
    await expect(update("closed_at = 200, updated_at = 200")).rejects.toThrow(
      "account security state is not monotonic",
    )
    await closeAccount(fixture)
    await expect(update("status = 'active', token_version = token_version + 1")).rejects.toThrow(
      "account security state is not monotonic",
    )
  })

  test("Identityはproviderと時刻の順序を満たす行だけを受け入れる", async () => {
    const fixture = await createFixture()
    const identity = (name: string) => testDerivedId("identity", name)

    await expect(
      insertIdentity(fixture, { id: identity("provider"), provider: "unknown", subject: "s-1" }),
    ).rejects.toThrow("CHECK constraint failed")
    await expect(
      insertIdentity(fixture, {
        id: identity("activated-before-created"),
        provider: "password",
        subject: "s-2",
        activatedAt: 99,
      }),
    ).rejects.toThrow("CHECK constraint failed")
    await expect(
      insertIdentity(fixture, {
        id: identity("revoked-before-activated"),
        provider: "password",
        subject: "s-3",
        activatedAt: 120,
        revokedAt: 110,
      }),
    ).rejects.toThrow("CHECK constraint failed")

    await insertIdentity(fixture, {
      id: identity("valid"),
      provider: "password",
      subject: "s-4",
      activatedAt: 120,
    })
    const updateIdentity = (assignments: string) =>
      fixture.database
        .prepare(`UPDATE system_identity_bindings SET ${assignments} WHERE id = ?1`)
        .bind(identity("valid"))
        .run()
    await expect(updateIdentity("subject = 's-5'")).rejects.toThrow(
      "identity binding identity is immutable",
    )
    await expect(updateIdentity("activated_at = 130")).rejects.toThrow(
      "identity lifecycle is not monotonic",
    )
  })

  test("password credentialはpasswordのIdentityと時刻の順序を要求する", async () => {
    const fixture = await createFixture()
    const passwordIdentity = testDerivedId("identity", "password")
    const externalIdentity = testDerivedId("identity", "external")
    await insertIdentity(fixture, {
      id: passwordIdentity,
      provider: "password",
      subject: "person@example.com",
    })
    await insertIdentity(fixture, { id: externalIdentity, provider: "oidc", subject: "subject-1" })

    await expect(
      insertCredential(fixture, {
        identityId: externalIdentity,
        changedAt: 100,
        createdAt: 100,
        updatedAt: 100,
      }),
    ).rejects.toThrow("password credential requires password identity")
    await expect(
      insertCredential(fixture, {
        identityId: passwordIdentity,
        changedAt: 99,
        createdAt: 100,
        updatedAt: 100,
      }),
    ).rejects.toThrow("CHECK constraint failed")
    await expect(
      insertCredential(fixture, {
        identityId: passwordIdentity,
        changedAt: 110,
        createdAt: 100,
        updatedAt: 105,
      }),
    ).rejects.toThrow("CHECK constraint failed")
    await expect(
      fixture.database
        .prepare(
          `INSERT INTO system_password_credentials
             (identity_id, password_hash, changed_at, created_at, updated_at)
           VALUES (?1, 'short', 100, 100, 100)`,
        )
        .bind(passwordIdentity)
        .run(),
    ).rejects.toThrow("CHECK constraint failed")

    await insertCredential(fixture, {
      identityId: passwordIdentity,
      changedAt: 110,
      createdAt: 100,
      updatedAt: 110,
    })
    await expect(
      fixture.database
        .prepare(
          "UPDATE system_password_credentials SET changed_at = 105, updated_at = 120 WHERE identity_id = ?1",
        )
        .bind(passwordIdentity)
        .run(),
    ).rejects.toThrow("password credential change is not monotonic")
  })
})
