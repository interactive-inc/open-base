import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { createExternalIdentityImportTestContext } from "@/contexts/company/test/external-identity-import.test-support"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { ExternalIdentityImportInput } from "@/contexts/company/domain/entities/external-identity-import.entity"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { CompanyAccountEmployeeLinksReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/company-account-employee-links-read.adapter"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { ApplyExternalIdentities } from "@/contexts/company/application/external-identities/apply-external-identities"
import { ExternalIdentityImportRepository } from "@/contexts/company/infrastructure/repositories/external-identities/external-identity-import.repository"
import { SystemIdentityAttachmentAdapter } from "@system/infrastructure/adapters/identity/system-identity-attachment.adapter"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

function update(
  input: ExternalIdentityImportInput,
  sourceRevision = 2,
): ExternalIdentityImportInput {
  return {
    ...input,
    commandId: `import:update:${sourceRevision}`,
    expectedRevision: input.expectedRevision + 1,
    identities: input.identities.map((identity) => ({
      ...identity,
      sourceRevision,
      name: "Updated Person",
      email: "updated@example.com",
    })),
  }
}

/**
 * 権限の割当を作る。globalは全社、scopedは取込と別のprovider、scoped-oidcは取込と同じproviderに
 * 限った割当、revokedは取り消し済みの全社の割当。
 */
async function grantPermission(
  database: D1Database,
  accountId: string,
  kind: string,
  permission: string,
) {
  if (kind === "none") return
  const roleId = crypto.randomUUID()
  const scoped = kind === "scoped" || kind === "scoped-oidc"
  const resourceType = scoped ? "system:identity_provider" : null
  await database.batch([
    database
      .prepare(`INSERT INTO system_iam_roles
        (id, key, kind, resource_type, name, created_at, updated_at)
        VALUES (?1, ?2, 'custom', ?3, 'Granted permission', 0, 0)`)
      .bind(roleId, `custom:import-grant:${roleId}`, resourceType),
    database
      .prepare("INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES (?1, ?2)")
      .bind(roleId, permission),
    database
      .prepare(`INSERT INTO system_role_bindings
        (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
        VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6)`)
      .bind(
        crypto.randomUUID(),
        accountId,
        roleId,
        resourceType,
        resourceType === null ? null : kind === "scoped-oidc" ? "oidc" : "other-provider",
        kind === "revoked" ? 1 : null,
      ),
  ])
}

describe("外部identityとCompany正本の同期", () => {
  test("入社前のAccount対応を有効にせず、初期対応は公開履歴へ一緒に保存する", async () => {
    const c = await createExternalIdentityImportTestContext()
    const identity = c.input.identities[0]!
    expect(
      (
        await c.application.execute({
          ...c.input,
          identities: [
            { ...identity, newEmployee: { hireDate: "2030-07-01", employmentType: "FULL_TIME" } },
          ],
        })
      ).kind,
    ).toBe("applied")
    const reader = new CompanyAccountEmployeeLinksReadAdapter({ env: { DB: c.database } })
    expect(await reader.findMany({ asOf: restoreCalendarDate("2030-06-30") })).toEqual([])
    const active = await reader.findMany({ asOf: restoreCalendarDate("2030-07-01") })
    if (active instanceof Error) throw active
    expect(active).toHaveLength(1)
    expect(
      (
        await c.database
          .prepare("SELECT starts_on, source FROM company_account_employee_link_periods")
          .all()
      ).results,
    ).toEqual([{ starts_on: "2030-07-01", source: "public" }])
    await execSql(c.database, "DROP TRIGGER IF EXISTS company_account_employee_links_delete_guard")
    await execSql(c.database, "DELETE FROM company_account_employee_links")
    await execSql(c.database, "DROP VIEW company_account_employee_link_periods")
    expect(await reader.findMany({ asOf: restoreCalendarDate("2030-07-01") })).toEqual(active)
  })
  test.each([
    "UPDATE system_role_bindings SET revoked_at = 1 WHERE id = '721e4694-365f-47cd-8983-0743ec63c76d'",
    "UPDATE system_machine_credentials SET status = 'revoked', revoked_at = updated_at",
    "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'system:admin')",
  ])("準備後の許可変更でも同期全体を拒否する: %s", async (sql) => {
    const c = await createExternalIdentityImportTestContext()
    const batch = c.database.batch.bind(c.database)
    const interception = spyOn(c.database, "batch").mockImplementationOnce(async (statements) => {
      await execSql(c.database, sql)
      return batch(statements)
    })
    try {
      expect((await c.application.execute(c.input)).kind).toBe("unavailable")
      expect(
        await c.database
          .prepare("SELECT count(*) AS total FROM company_employees")
          .first<number>("total"),
      ).toBe(0)
      expect(
        await c.database
          .prepare("SELECT count(*) AS total FROM company_external_identity_imports")
          .first<number>("total"),
      ).toBe(0)
      expect(
        await c.database
          .prepare(
            "SELECT count(*) AS total FROM system_accounts WHERE id <> '26c690b3-a723-4977-b299-36862160bfce'",
          )
          .first<number>("total"),
      ).toBe(0)
    } finally {
      interception.mockRestore()
    }
  })
  test("メール一致でAccountへ自動接続せず、明示したAccountだけへidentityを追加する", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await c.application.execute(c.input)).kind).toBe("applied")
    const accountId = zAccountId.parse(
      await c.database
        .prepare(
          "SELECT account_id FROM system_identity_bindings WHERE subject = 'external-person-1'",
        )
        .first<string>("account_id"),
    )
    const next = {
      ...c.input,
      commandId: "import:attach",
      expectedRevision: c.input.expectedRevision + 1,
      identities: c.input.identities.map((identity) => ({
        ...identity,
        subject: "another-external-subject",
      })),
    }
    expect(await c.application.execute(next)).toMatchObject({
      kind: "conflict",
      reason: "explicit_account_link_required",
    })
    expect(
      await c.application.execute({
        ...next,
        identities: next.identities.map((identity) => ({
          ...identity,
          accountId,
          newEmployee: null,
          initialRoleId: null,
        })),
      }),
    ).toMatchObject({ kind: "applied", summary: { created: 1, updated: 0, skipped: 0 } })
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_employees")
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 1 })
    expect(
      await c.database
        .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
        .bind(accountId)
        .first<number>("token_version"),
    ).toBe(1)
  })

  test.each([
    ["system:admin", "global", "none", "forbidden"],
    ["system:admin", "scoped", "none", "forbidden"],
    ["system:admin", "global", "revoked", "forbidden"],
    ["system:admin", "none", "none", "applied"],
    ["system:admin", "revoked", "none", "applied"],
    ["system:admin", "global", "global", "applied"],
    ["system:admin", "global", "scoped", "forbidden"],
    ["system:admin", "global", "scoped-oidc", "forbidden"],
    ["billing:operate", "global", "none", "forbidden"],
    ["billing:operate", "scoped", "none", "forbidden"],
    ["billing:operate", "global", "global", "applied"],
    ["billing:operate", "global", "scoped-oidc", "forbidden"],
  ])(
    "既存Accountへのidentity追加は実行者が対象の権限を全社で覆うときだけ許す（%s、対象: %s、実行者: %s、結果: %s）",
    async (permission, targetGrant, actorGrant, expected) => {
      const c = await createExternalIdentityImportTestContext()
      expect((await c.application.execute(c.input)).kind).toBe("applied")
      const accountId = zAccountId.parse(
        await c.database
          .prepare(
            "SELECT account_id FROM system_identity_bindings WHERE subject = 'external-person-1'",
          )
          .first<string>("account_id"),
      )
      await grantPermission(c.database, accountId, targetGrant, permission)
      await grantPermission(c.database, c.actor.accountId, actorGrant, permission)
      const tables = [
        "system_accounts",
        "system_identity_bindings",
        "system_identity_profiles",
        "system_audit_events",
        "company_resource_revisions",
        "company_external_identity_sources",
        "company_external_identity_imports",
      ]
      const counts = () =>
        Promise.all(
          tables.map((table) =>
            c.database.prepare(`SELECT count(*) AS total FROM ${table}`).first<number>("total"),
          ),
        )
      const before = await counts()
      const next = {
        ...c.input,
        commandId: "import:attach-root",
        expectedRevision: c.input.expectedRevision + 1,
        identities: c.input.identities.map((identity) => ({
          ...identity,
          subject: "another-external-subject",
          accountId,
          initialRoleId: null,
          newEmployee: null,
          name: "Changed Person",
          email: "changed@example.com",
        })),
      }
      const result = await c.application.execute(next)
      if (expected === "forbidden") {
        expect(result).toEqual({ kind: "forbidden" })
        expect(await counts()).toEqual(before)
        expect(
          await c.database
            .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
            .bind(accountId)
            .first<number>("token_version"),
        ).toBe(0)
        expect(
          await c.database
            .prepare("SELECT official_name, email FROM company_employees")
            .first<Record<string, unknown>>(),
        ).toEqual({ official_name: "Example Person", email: "you@example.com" })
        expect(
          await c.database
            .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
            .bind(COMPANY_DEFAULT_ORGANIZATION_ID)
            .first<number>("revision"),
        ).toBe(next.expectedRevision)
        return
      }
      expect(result).toMatchObject({
        kind: "applied",
        summary: { created: 1, updated: 0, skipped: 0 },
      })
      expect(
        await c.database
          .prepare("SELECT account_id FROM system_identity_bindings WHERE subject = ?1")
          .bind(next.identities[0]!.subject)
          .first<string>("account_id"),
      ).toBe(accountId)
    },
  )

  test("rootを持たない実行者も既存のroot Accountのidentityは更新できる", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await c.application.execute(c.input)).kind).toBe("applied")
    const accountId = zAccountId.parse(
      await c.database
        .prepare(
          "SELECT account_id FROM system_identity_bindings WHERE subject = 'external-person-1'",
        )
        .first<string>("account_id"),
    )
    await grantPermission(c.database, accountId, "global", "system:admin")
    expect(await c.application.execute(update(c.input))).toMatchObject({
      kind: "applied",
      summary: { created: 0, updated: 1, skipped: 0 },
    })
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_identity_bindings")
        .first<number>("total"),
    ).toBe(1)
    expect(
      await c.database.prepare("SELECT email FROM system_identity_profiles").first<string>("email"),
    ).toBe("updated@example.com")
  })

  test.each([
    ["shared@example.com", "shared@example.com"],
    ["Shared@Example.com", "shared@example.com"],
  ])("新規subjectの同メールを保存せず拒否する: %s / %s", async (email, otherEmail) => {
    const c = await createExternalIdentityImportTestContext()
    const identity = c.input.identities[0]!
    const tables = [
      "system_accounts",
      "system_identity_bindings",
      "system_identity_profiles",
      "company_employees",
      "company_employments",
      "company_resource_revisions",
      "company_external_identity_sources",
      "company_external_identity_imports",
      "system_audit_events",
    ]
    const counts = () =>
      Promise.all(
        tables.map((table) =>
          c.database.prepare(`SELECT count(*) AS total FROM ${table}`).first<number>("total"),
        ),
      )
    const before = await counts()
    expect(
      await c.application.execute({
        ...c.input,
        identities: [
          { ...identity, email },
          { ...identity, subject: "external-person-2", email: otherEmail },
        ],
      }),
    ).toMatchObject({ kind: "conflict", reason: "explicit_account_link_required" })
    expect(await counts()).toEqual(before)
    expect(
      await c.database
        .prepare("SELECT revision FROM company_organizations WHERE id = ?1")
        .bind(COMPANY_DEFAULT_ORGANIZATION_ID)
        .first<number>("revision"),
    ).toBe(c.input.expectedRevision)
  })

  test.each([false, true])(
    "異なるメールの複数新規作成を適用する（既存identityの再取得: %s）",
    async (includeExisting) => {
      const c = await createExternalIdentityImportTestContext()
      if (includeExisting) expect((await c.application.execute(c.input)).kind).toBe("applied")
      const identity = c.input.identities[0]!
      expect(
        await c.application.execute({
          ...c.input,
          commandId: "import:multiple",
          expectedRevision: c.input.expectedRevision + (includeExisting ? 1 : 0),
          identities: [
            ...(includeExisting ? [identity] : []),
            { ...identity, subject: "external-person-2", email: "second@example.com" },
            { ...identity, subject: "external-person-3", email: "third@example.com" },
          ],
        }),
      ).toMatchObject({
        kind: "applied",
        summary: { created: 2, updated: 0, skipped: includeExisting ? 1 : 0 },
      })
      expect(
        await c.database
          .prepare("SELECT count(*) AS total FROM company_employees")
          .first<number>("total"),
      ).toBe(includeExisting ? 3 : 2)
    },
  )

  test("既存identityの更新と同メールの新規作成が混在しても全体を拒否する", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await c.application.execute(c.input)).kind).toBe("applied")
    const identity = c.input.identities[0]!
    expect(
      await c.application.execute({
        ...c.input,
        commandId: "import:mixed-duplicate",
        expectedRevision: c.input.expectedRevision + 1,
        identities: [
          { ...identity, sourceRevision: 2, name: "Changed Person" },
          { ...identity, subject: "external-person-2", email: "shared@example.com" },
          { ...identity, subject: "external-person-3", email: "SHARED@example.com" },
        ],
      }),
    ).toMatchObject({ kind: "conflict", reason: "explicit_account_link_required" })
    expect(
      await c.database
        .prepare("SELECT official_name FROM company_employees")
        .first<string>("official_name"),
    ).toBe(identity.name)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<number>("total"),
    ).toBe(4)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_external_identity_imports")
        .first<number>("total"),
    ).toBe(1)
    expect(
      await c.database
        .prepare("SELECT source_revision FROM company_external_identity_sources")
        .first<number>("source_revision"),
    ).toBe(1)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM system_accounts")
        .first<number>("total"),
    ).toBe(2)
  })

  test("操作主体が持たない権限のAccountへidentityを追加しない", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await c.application.execute(c.input)).kind).toBe("applied")
    const accountId = zAccountId.parse(
      await c.database
        .prepare(
          "SELECT account_id FROM system_identity_bindings WHERE subject = 'external-person-1'",
        )
        .first<string>("account_id"),
    )
    await execSql(
      c.database,
      `INSERT INTO system_iam_roles (id, key, kind, resource_type, name, created_at, updated_at)
         VALUES ('5d0b0f7e-3f5e-4b8e-9d55-2c1f4d0e8a11', 'custom:import-root', 'custom', NULL, 'Root', 0, 0);
       INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('5d0b0f7e-3f5e-4b8e-9d55-2c1f4d0e8a11', 'system:admin');
       INSERT INTO system_role_bindings (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
         VALUES ('0e6c1a4f-8a3b-4c2d-9e7f-6b5a4c3d2e1f', '${accountId}', '5d0b0f7e-3f5e-4b8e-9d55-2c1f4d0e8a11', NULL, NULL, 0, NULL);`,
    )
    const attach = {
      ...c.input,
      commandId: "import:attach-root",
      expectedRevision: c.input.expectedRevision + 1,
      identities: c.input.identities.map((identity) => ({
        ...identity,
        subject: "controlled-external-subject",
        accountId,
        newEmployee: null,
        initialRoleId: null,
      })),
    }
    const countAttached = () =>
      c.database
        .prepare(
          "SELECT count(*) AS total FROM system_identity_bindings WHERE subject = 'controlled-external-subject'",
        )
        .first<number>("total")
    expect((await c.application.execute(attach)).kind).toBe("forbidden")
    expect(await countAttached()).toBe(0)

    // 事前判定を通っても、同じ変更単位のSQL guardで昇格を拒否する。
    const bypass = spyOn(SystemIdentityAttachmentAdapter.prototype, "canAttach").mockResolvedValue(
      true,
    )
    try {
      expect((await c.application.execute(attach)).kind).not.toBe("applied")
    } finally {
      bypass.mockRestore()
    }
    expect(await countAttached()).toBe(0)
    expect(
      await c.database
        .prepare("SELECT token_version FROM system_accounts WHERE id = ?1")
        .bind(accountId)
        .first<number>("token_version"),
    ).toBe(0)

    // 対象の全権限を持つ操作主体なら同じ追加を確定できる。
    await execSql(
      c.database,
      `INSERT INTO system_iam_role_permissions (role_id, permission_key)
         VALUES ('ac330a23-4c0c-4f72-8aa8-3c4a92f58ff8', 'system:admin')`,
    )
    expect(await c.application.execute(attach)).toMatchObject({
      kind: "applied",
      summary: { created: 1, updated: 0, skipped: 0 },
    })
    expect(await countAttached()).toBe(1)
  })

  test("更新監査の失敗で氏名・email・外部版をすべて旧値へ戻す", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await c.application.execute(c.input)).kind).toBe("applied")
    await execSql(
      c.database,
      "CREATE TRIGGER reject_import_update BEFORE INSERT ON system_audit_events WHEN NEW.action = 'company.external_identity.imported' BEGIN SELECT RAISE(ABORT, 'injected update failure'); END;",
    )
    const next = update(c.input)
    expect((await c.application.execute(next)).kind).toBe("unavailable")
    expect(
      await c.database
        .prepare("SELECT official_name, email FROM company_employees")
        .first<Record<string, unknown>>(),
    ).toEqual({ official_name: "Example Person", email: "you@example.com" })
    expect(
      await c.database
        .prepare("SELECT email FROM system_identity_profiles")
        .first<Record<string, unknown>>(),
    ).toEqual({ email: "you@example.com" })
    expect(
      await c.database
        .prepare("SELECT source_revision FROM company_external_identity_sources")
        .first<number>("source_revision"),
    ).toBe(1)
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<number>("total"),
    ).toBe(4)
    await execSql(c.database, "DROP TRIGGER reject_import_update")
    expect((await c.application.execute(next)).kind).toBe("applied")
  })

  test("同じcommandの同時送信は一度だけ適用し、異なるcommandの競合は一方だけを確定する", async () => {
    const c = await createExternalIdentityImportTestContext()
    const same = await Promise.all([c.application.execute(c.input), c.application.execute(c.input)])
    expect(same.map((result) => result.kind)).toEqual(["applied", "applied"])
    expect(same.filter((result) => result.kind === "applied" && result.replayed)).toHaveLength(1)
    const next = update(c.input)
    const different = await Promise.all([
      c.application.execute(next),
      c.application.execute({ ...next, commandId: "other-command" }),
    ])
    expect(different.map((result) => result.kind).sort()).toEqual(["applied", "conflict"])
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<number>("total"),
    ).toBe(5)
  })

  // 同じ命令の同時送信で、最初の受領の照会の後に他方が確定した場合を決まった順で再現する。
  test("最初の照会の後に同じcommandが確定しても、競合ではなく保存済みの結果を返す", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await c.application.execute(c.input)).kind).toBe("applied")
    let hidden = false
    const database = new Proxy(c.database, {
      get(target, property, receiver) {
        if (property !== "prepare") return Reflect.get(target, property, receiver)
        return (sql: string) => {
          if (!hidden && sql.includes("FROM company_external_identity_imports")) {
            hidden = true
            // 他方の確定より前に読んだ結果として、受領が無い状態を返す。
            return { bind: () => ({ first: async () => null }) }
          }
          return target.prepare(sql)
        }
      },
    })
    const late = new ApplyExternalIdentities({
      repository: new ExternalIdentityImportRepository({
        env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo" },
      }),
      actor: c.actor,
      now: () => c.clock.at,
    })
    expect(await late.execute(c.input)).toMatchObject({ kind: "applied", replayed: true })
    expect(hidden).toBe(true)
  })

  test("操作主体が持たない権限を新規Accountへ付与しない", async () => {
    const c = await createExternalIdentityImportTestContext()
    await execSql(
      c.database,
      "INSERT INTO system_iam_role_permissions (role_id, permission_key) VALUES ('1f178fc9-9b4d-4247-8dc8-8f1344bf445d', 'system:admin')",
    )
    expect((await c.application.execute(c.input)).kind).toBe("forbidden")
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_employees")
        .first<number>("total"),
    ).toBe(0)
  })

  test("明示された雇用日・区分で公開正本、Account、期間、監査を同時に作る", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect(await c.application.execute(c.input)).toEqual({
      kind: "applied",
      summary: { created: 1, updated: 0, skipped: 0 },
      organizationRevision: c.input.expectedRevision + 1,
      replayed: false,
    })
    const resources = await new D1CompanyResourceRepository({ database: c.database }).findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["person", "employee", "employment"],
      effectiveOn: restoreCalendarDate("2026-01-01"),
    })
    if (!resources.ok) throw resources.cause
    expect(resources.resources.map((resource) => resource.type).sort()).toEqual([
      "employee",
      "employment",
      "person",
    ])
    expect(
      resources.resources.find((resource) => resource.type === "employment")?.attributes,
    ).toMatchObject({ employmentType: "PART_TIME", status: "ACTIVE" })
    expect(
      await c.database
        .prepare("SELECT hire_date, employment_type FROM company_employments")
        .first<Record<string, unknown>>(),
    ).toEqual({ hire_date: "2026-01-01", employment_type: "PART_TIME" })
    expect(
      await c.database
        .prepare("SELECT starts_on, status FROM company_employee_status_period_versions")
        .first<Record<string, unknown>>(),
    ).toEqual({ starts_on: "2026-01-01", status: "active" })
    expect(
      await c.database
        .prepare(
          "SELECT actor_account_id, metadata_json FROM system_audit_events WHERE action = 'company.external_identity.imported'",
        )
        .first<Record<string, unknown>>(),
    ).toMatchObject({
      actor_account_id: c.actor.accountId,
      metadata_json: expect.stringContaining(c.actor.credentialId),
    })
  })

  test("command再送と同じ外部版の再取得で履歴を増やさない", async () => {
    const c = await createExternalIdentityImportTestContext()
    const first = await c.application.execute(c.input)
    expect(first.kind).toBe("applied")
    expect(await c.application.execute(c.input)).toMatchObject({ kind: "applied", replayed: true })
    expect(
      await c.application.execute({
        ...c.input,
        commandId: "import:rescan",
        expectedRevision: c.input.expectedRevision + 1,
      }),
    ).toMatchObject({ kind: "applied", summary: { created: 0, updated: 0, skipped: 1 } })
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_resource_revisions")
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 4 })
    expect(
      await c.database
        .prepare(
          "SELECT count(*) AS total FROM system_audit_events WHERE action = 'company.external_identity.imported'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 1 })
    expect(
      await c.database
        .prepare(
          "SELECT actor_account_id, machine_credential_id, reason, expected_revision, organization_revision FROM company_external_identity_imports WHERE command_id = 'import:rescan'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({
      actor_account_id: c.actor.accountId,
      machine_credential_id: c.actor.credentialId,
      reason: c.input.reason,
      expected_revision: c.input.expectedRevision + 1,
      organization_revision: c.input.expectedRevision + 2,
    })
  })

  test("氏名・email変更を公開Person・業務台帳・Account表示・Identityへ反映する", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await c.application.execute(c.input)).kind).toBe("applied")
    expect(await c.application.execute(update(c.input))).toMatchObject({
      kind: "applied",
      summary: { created: 0, updated: 1, skipped: 0 },
    })
    expect(
      await c.database
        .prepare("SELECT official_name, email FROM company_employees")
        .first<Record<string, unknown>>(),
    ).toEqual({ official_name: "Updated Person", email: "updated@example.com" })
    expect(
      await c.database
        .prepare("SELECT display_name FROM company_account_profiles")
        .first<Record<string, unknown>>(),
    ).toEqual({ display_name: "Updated Person" })
    expect(
      await c.database
        .prepare("SELECT email FROM system_identity_profiles")
        .first<Record<string, unknown>>(),
    ).toEqual({ email: "updated@example.com" })
    const resources = await new D1CompanyResourceRepository({ database: c.database }).findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["person"],
    })
    if (!resources.ok) throw resources.cause
    expect(resources.resources[0]?.attributes).toMatchObject({
      officialName: "Updated Person",
      email: "updated@example.com",
    })
    expect(
      await c.database
        .prepare(
          "SELECT count(*) AS total FROM company_resource_revisions WHERE resource_type = 'person'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 2 })
  })

  test.each(["source", "command", "organization"])(
    "%sの競合と外部の順序逆転を拒否する",
    async (kind) => {
      const c = await createExternalIdentityImportTestContext()
      expect((await c.application.execute(c.input)).kind).toBe("applied")
      expect((await c.application.execute(update(c.input))).kind).toBe("applied")
      const old = {
        ...c.input,
        expectedRevision: c.input.expectedRevision + 2,
        commandId: "import:old",
      }
      if (kind === "command") old.commandId = c.input.commandId
      if (kind === "organization") old.expectedRevision = c.input.expectedRevision
      expect(await c.application.execute(old)).toMatchObject({ kind: "conflict" })
      expect(
        await c.database
          .prepare("SELECT official_name FROM company_employees")
          .first<Record<string, unknown>>(),
      ).toEqual({ official_name: "Updated Person" })
    },
  )

  test.each([
    "company_resource_revisions",
    "company_employee_status_period_versions",
    "system_audit_events",
    "company_external_identity_imports",
  ])("%sの保存失敗でAccountを含む同期全体を取り消し、同じcommandで再試行できる", async (table) => {
    const c = await createExternalIdentityImportTestContext()
    await execSql(
      c.database,
      `CREATE TRIGGER reject_import BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'injected failure'); END;`,
    )
    expect((await c.application.execute(c.input)).kind).toBe("unavailable")
    expect(
      await c.database
        .prepare(
          "SELECT count(*) AS total FROM system_accounts WHERE id <> '26c690b3-a723-4977-b299-36862160bfce'",
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 0 })
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_employees")
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 0 })
    expect(
      await c.database
        .prepare(
          `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
        )
        .first<Record<string, unknown>>(),
    ).toEqual({ revision: c.input.expectedRevision })
    await execSql(c.database, "DROP TRIGGER reject_import")
    expect((await c.application.execute(c.input)).kind).toBe("applied")
  })

  test("batch途中の不正な新規雇用で先頭のAccountも保存しない", async () => {
    const c = await createExternalIdentityImportTestContext()
    const first = c.input.identities[0]
    if (first === undefined) throw new Error("fixture identity missing")
    expect(
      await c.application.execute({
        ...c.input,
        identities: [
          first,
          {
            ...first,
            subject: "missing-employment",
            email: "other@example.com",
            newEmployee: null,
          },
        ],
      }),
    ).toMatchObject({ kind: "invalid" })
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_employees")
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 0 })
  })

  test("許可provider以外と失効credentialで会社情報を変更しない", async () => {
    // fixture は全 migration を適用するので 1 回だけ作り、provider の付与を失効と再付与で差し替える。
    const c = await createExternalIdentityImportTestContext()
    const grant = (id: string, provider: string) =>
      c.database
        .prepare(`INSERT INTO system_role_bindings
          (id, account_id, role_id, resource_type, resource_id, created_at, revoked_at)
          VALUES (?1, '26c690b3-a723-4977-b299-36862160bfce', '8ca6d30f-174b-40e1-870b-df888721f554', 'system:identity_provider', ?2, 0, NULL)`)
        .bind(id, provider)
        .run()
    await execSql(
      c.database,
      "UPDATE system_role_bindings SET revoked_at = 1 WHERE id = '721e4694-365f-47cd-8983-0743ec63c76d'",
    )
    const otherProviderBinding = crypto.randomUUID()
    await grant(otherProviderBinding, "other-provider")
    expect((await c.application.execute(c.input)).kind).toBe("forbidden")
    await c.database
      .prepare("UPDATE system_role_bindings SET revoked_at = 1 WHERE id = ?1")
      .bind(otherProviderBinding)
      .run()
    await grant(crypto.randomUUID(), "oidc")
    await execSql(
      c.database,
      "UPDATE system_machine_credentials SET status = 'revoked', revoked_at = updated_at",
    )
    expect((await c.application.execute(c.input)).kind).toBe("forbidden")
    expect(
      await c.database
        .prepare("SELECT count(*) AS total FROM company_employees")
        .first<Record<string, unknown>>(),
    ).toEqual({ total: 0 })
  })

  test("同期記録の書換え・削除・外部版の巻き戻しをDBで拒否する", async () => {
    const c = await createExternalIdentityImportTestContext()
    expect((await c.application.execute(c.input)).kind).toBe("applied")
    for (const sql of [
      "DELETE FROM company_external_identity_imports",
      "UPDATE company_external_identity_imports SET result_json = '{}'",
      "DELETE FROM company_external_identity_sources",
      "UPDATE company_external_identity_sources SET source_revision = source_revision",
    ]) {
      const failure = await execSql(c.database, sql).then(
        () => null,
        (cause: unknown) => cause,
      )
      expect(failure).toBeInstanceOf(Error)
    }
  })
})
