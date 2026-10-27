import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import {
  BootstrapSystemRoot,
  type SystemPasswordHasher,
} from "@system/application/iam/bootstrap-system-root"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { D1SystemRootBootstrapAdapter } from "@system/infrastructure/adapters/iam/d1-system-root-bootstrap.adapter"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schema = readFileSync(
  new URL("../infrastructure/schema/system-core.sql", import.meta.url),
  "utf8",
)
const integrationSchema = readFileSync(
  new URL("../infrastructure/schema/system-integration.sql", import.meta.url),
  "utf8",
)
const principalSchema = readFileSync(
  new URL("../infrastructure/schema/system-principal.sql", import.meta.url),
  "utf8",
)
const now = new Date("2026-08-19T00:00:00.000Z")
const passwordHash = "pbkdf2$sha256$test-password-hash"
async function createFixture(): Promise<{
  application: BootstrapSystemRoot
  database: D1Database
  repository: D1SystemRootBootstrapAdapter
}> {
  const database = await createLocalD1Database({
    schema: [schema, integrationSchema, principalSchema].join("\n"),
  })
  const repository = new D1SystemRootBootstrapAdapter({
    env: { DB: database },
  })
  const passwordHasher: SystemPasswordHasher = {
    hash: async () => passwordHash,
  }

  return {
    application: new BootstrapSystemRoot({ passwordHasher, repository }),
    database,
    repository,
  }
}

async function count(database: D1Database, table: string): Promise<number> {
  const row = await database
    .prepare(`SELECT COUNT(*) AS count FROM ${table}`)
    .first<{ count: number }>()
  return row?.count ?? 0
}

describe("System root bootstrap", () => {
  test("Companyなしでcanonical System Accountとcredentialとglobal rootを原子的に作る", async () => {
    const { application, database } = await createFixture()

    const result = await application.execute({
      email: "  ROOT@Example.COM ",
      password: "correct horse battery staple",
      now,
    })

    expect(result).not.toBeInstanceOf(Error)
    expect(result).toMatchObject({ kind: "created" })
    if (result instanceof Error || result.kind !== "created") throw new Error("bootstrap failed")

    expect(
      await database
        .prepare(`SELECT account.status, account.token_version,
                  identity.provider, identity.subject,
                  profile.email, profile.email_verified,
                  credential.password_hash
           FROM system_accounts account
           INNER JOIN system_identity_bindings identity ON identity.account_id = account.id
           INNER JOIN system_identity_profiles profile ON profile.identity_id = identity.id
           INNER JOIN system_password_credentials credential ON credential.identity_id = identity.id
           WHERE account.id = ?1`)
        .bind(result.accountId)
        .first<Record<string, unknown>>(),
    ).toEqual({
      status: "active",
      token_version: 0,
      provider: "password",
      subject: "root@example.com",
      email: "root@example.com",
      email_verified: 1,
      password_hash: passwordHash,
    })
    expect(
      await database
        .prepare(`SELECT role.key, role.kind, binding.resource_type, binding.resource_id
           FROM system_role_bindings binding
           INNER JOIN system_iam_roles role ON role.id = binding.role_id
           WHERE binding.id = ?1`)
        .bind(result.rootBindingId)
        .first<Record<string, unknown>>(),
    ).toEqual({
      key: "system:root",
      kind: "managed",
      resource_type: null,
      resource_id: null,
    })
    expect(
      (
        await database
          .prepare(`SELECT permission_key
           FROM system_iam_role_permissions
           WHERE role_id = (SELECT role_id FROM system_role_bindings WHERE id = ?1)
           ORDER BY permission_key`)
          .bind(result.rootBindingId)
          .all<Record<string, unknown>>()
      ).results,
    ).toEqual([
      { permission_key: "iam:read" },
      { permission_key: "iam:write" },
      { permission_key: "system:admin" },
    ])
    expect(
      await database
        .prepare(`SELECT completed_by_account_id, root_binding_id, completed_at
           FROM system_bootstrap_state`)
        .first<Record<string, unknown>>(),
    ).toEqual({
      completed_by_account_id: result.accountId,
      root_binding_id: result.rootBindingId,
      completed_at: now.getTime(),
    })
    expect(
      await database
        .prepare(`SELECT actor_account_id, action, target_type, target_id, outcome, occurred_at
           FROM system_audit_events`)
        .first<Record<string, unknown>>(),
    ).toEqual({
      actor_account_id: null,
      action: "system.bootstrap.completed",
      target_type: "system_account",
      target_id: result.accountId,
      outcome: "succeeded",
      occurred_at: now.getTime(),
    })
    expect(
      JSON.stringify(
        (await database.prepare("SELECT * FROM system_audit_events").all<Record<string, unknown>>())
          .results,
      ),
    ).not.toContain("root@example.com")
  })

  test("完了後の再実行は既存識別子を返し一行も増やさない", async () => {
    const { application, database } = await createFixture()
    const command = {
      email: "root@example.com",
      password: "correct horse battery staple",
      now,
    }

    const first = await application.execute(command)
    const second = await application.execute(command)
    expect(first).not.toBeInstanceOf(Error)
    if (first instanceof Error || first.kind !== "created") throw new Error("bootstrap failed")
    expect(second).toEqual({
      kind: "already_initialized",
      accountId: first.accountId,
      identityId: first.identityId,
      rootBindingId: first.rootBindingId,
      email: "root@example.com",
      state: "complete",
    })
    expect(await count(database, "system_accounts")).toBe(1)
    expect(await count(database, "system_identity_bindings")).toBe(1)
    expect(await count(database, "system_role_bindings")).toBe(1)
    expect(await count(database, "system_bootstrap_state")).toBe(1)
    expect(await count(database, "system_audit_events")).toBe(1)
  })

  test("Accountが先に存在する不完全環境は上書きせずfail closedする", async () => {
    const { application, database } = await createFixture()
    await execSql(
      database,
      `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
       VALUES ('c1cf1957-9ca8-4876-91d3-809100404574', 'active', 0, 1, 1)`,
    )

    expect(
      await application.execute({
        email: "root@example.com",
        password: "correct horse battery staple",
        now,
      }),
    ).toEqual({
      kind: "already_initialized",
      accountId: null,
      identityId: null,
      rootBindingId: null,
      email: null,
      state: "account_exists_without_bootstrap_state",
    })
    expect(await count(database, "system_accounts")).toBe(1)
    expect(await count(database, "system_identity_bindings")).toBe(0)
    expect(await count(database, "system_bootstrap_state")).toBe(0)
  })

  test("同時実行でも一方だけを作成し他方は同じ完了状態を読む", async () => {
    const { application, database } = await createFixture()
    const command = {
      email: "root@example.com",
      password: "correct horse battery staple",
      now,
    }

    const results = await Promise.all([application.execute(command), application.execute(command)])

    expect(
      results.filter((result) => !(result instanceof Error) && result.kind === "created"),
    ).toHaveLength(1)
    expect(
      results.filter(
        (result) =>
          !(result instanceof Error) &&
          result.kind === "already_initialized" &&
          result.state === "complete",
      ),
    ).toHaveLength(1)
    expect(await count(database, "system_identity_bindings")).toBe(1)
    expect(await count(database, "system_role_bindings")).toBe(1)
    expect(await count(database, "system_audit_events")).toBe(1)
  })

  test("System監査が保存できなければbootstrap全体と新規root roleをrollbackする", async () => {
    const { application, database } = await createFixture()
    await execSql(
      database,
      `
      CREATE TRIGGER reject_bootstrap_audit
      BEFORE INSERT ON system_audit_events
      BEGIN
        SELECT RAISE(ABORT, 'audit unavailable');
      END;
    `,
    )

    expect(
      await application.execute({
        email: "root@example.com",
        password: "correct horse battery staple",
        now,
      }),
    ).toBeInstanceOf(Error)
    expect(await count(database, "system_accounts")).toBe(0)
    expect(await count(database, "system_identity_bindings")).toBe(0)
    expect(await count(database, "system_iam_roles")).toBe(0)
    expect(await count(database, "system_bootstrap_state")).toBe(0)
    expect(await count(database, "system_audit_events")).toBe(0)
  })

  test("既存managed System root roleを再利用し複数候補なら変更前に拒否する", async () => {
    const first = await createFixture()
    await execSql(
      first.database,
      `
      INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at)
      VALUES ('b1c505c7-e6eb-4456-8ac2-4454a2fd5763', 'example:root', 'managed', 'Example root', 0, 0);
      INSERT INTO system_iam_role_permissions (role_id, permission_key)
      VALUES ('b1c505c7-e6eb-4456-8ac2-4454a2fd5763', 'system:admin');
    `,
    )
    const reused = await first.application.execute({
      email: "root@example.com",
      password: "correct horse battery staple",
      now,
    })
    expect(reused).not.toBeInstanceOf(Error)
    expect(
      await first.database
        .prepare(`SELECT role_id FROM system_role_bindings
           WHERE id = (SELECT root_binding_id FROM system_bootstrap_state)`)
        .first<Record<string, unknown>>(),
    ).toEqual({ role_id: "b1c505c7-e6eb-4456-8ac2-4454a2fd5763" })

    const second = await createFixture()
    await execSql(
      second.database,
      `
      INSERT INTO system_iam_roles (id, key, kind, name, created_at, updated_at) VALUES
        ('9d26e745-c224-44d6-827b-2c18965b203a', 'system:root-a', 'managed', 'Root A', 0, 0),
        ('b71d0533-2fa3-474e-8541-f33fa06193d9', 'system:root-b', 'managed', 'Root B', 0, 0);
      INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES
        ('9d26e745-c224-44d6-827b-2c18965b203a', 'system:admin'),
        ('b71d0533-2fa3-474e-8541-f33fa06193d9', 'system:admin');
    `,
    )
    expect(
      await second.application.execute({
        email: "root@example.com",
        password: "correct horse battery staple",
        now,
      }),
    ).toBeInstanceOf(Error)
    expect(await count(second.database, "system_identity_bindings")).toBe(0)
    expect(await count(second.database, "system_bootstrap_state")).toBe(0)
  })

  test("不正な時刻・email・passwordはhashとrepositoryへ到達させない", async () => {
    let hashCalls = 0
    let repositoryCalls = 0
    const passwordHasher: SystemPasswordHasher = {
      hash: async () => {
        hashCalls += 1
        return passwordHash
      },
    }
    const repository: Pick<D1SystemRootBootstrapAdapter, "bootstrap"> = {
      bootstrap: async () => {
        repositoryCalls += 1
        return new Error("must not be called")
      },
    }
    const application = new BootstrapSystemRoot({ passwordHasher, repository })

    expect(
      await application.execute({
        email: "root@example.com",
        password: "correct horse battery staple",
        now: new Date(Number.NaN),
      }),
    ).toEqual({ kind: "invalid_input", reason: "invalid_time" })
    expect(
      await application.execute({ email: "not-an-email", password: "a".repeat(12), now }),
    ).toEqual({ kind: "invalid_input", reason: "invalid_email" })
    expect(
      await application.execute({ email: "root@example.com", password: "a".repeat(11), now }),
    ).toEqual({ kind: "invalid_input", reason: "password_too_short" })
    expect(
      await application.execute({ email: "root@example.com", password: "a".repeat(201), now }),
    ).toEqual({ kind: "invalid_input", reason: "password_too_long" })
    expect(hashCalls).toBe(0)
    expect(repositoryCalls).toBe(0)
  })
})
