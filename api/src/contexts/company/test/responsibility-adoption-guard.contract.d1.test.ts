import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const GUARD = "company_responsibility_adoption_insert_guard"
const REJECTION = "responsibility adoption evidence is incomplete"
const sharedSql =
  readFileSync(
    new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8")

/** 同じ責務の接続を、共有SQLだけで作るDBと、全migrationを当てたDBの両方で検査する。 */
const fixtures = [
  { fixture: "共有SQLで作るDB", create: () => createLocalD1Database({ schema: sharedSql }) },
  { fixture: "migrationを当てたDB", create: () => createLocalD1Database() },
]

const ids = {
  actor: deterministicCompanyId("test-adoption-guard", "account:actor"),
  otherActor: deterministicCompanyId("test-adoption-guard", "account:other"),
  employee: deterministicCompanyId("test-adoption-guard", "employee"),
  employment: deterministicCompanyId("test-adoption-guard", "employment"),
  unit: deterministicCompanyId("test-adoption-guard", "unit"),
  unrelatedResource: deterministicCompanyId("test-adoption-guard", "resource:unrelated"),
}
const REASON = "Confirm responsibility history"
/** 接続の直前の会社版と、接続で進んだ後の会社版。 */
const EXPECTED_REVISION = 9
const ORGANIZATION_REVISION = 10

type Mapping = Readonly<{
  periodId: string
  responsibilityId: string
  authorityScopeId: string
  existingResourceId?: string
}>

type Connection = Readonly<{
  /** 確認済みの revision 1・2 を持つ既存の責務へ revision 3 として接続するか、新しい責務を作るか。 */
  target: "new" | "existing"
  /** 接続で保存した責務の改訂に残る主体と理由。証跡と食い違わせて改変を表す。 */
  appliedActorAccountId?: string
  appliedReason?: string
  /** 証跡へ保存する接続先の対応。 */
  toMapping?: (mapping: Mapping, resourceId: string) => Mapping
  /** 証跡へ保存する確認済みの公開責務。 */
  toConfirmed?: (
    confirmed: ReadonlyArray<Readonly<{ resourceId: string; revision: number }>>,
  ) => unknown
}>

async function readGuard(database: D1Database): Promise<string | null> {
  return database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?1")
    .bind(GUARD)
    .first<string>("sql")
}

/**
 * 検査する guard だけを残し、guard が読む行の親になる行を入れる。
 * 2つのDBは他の table の制約が同じとは限らないため、他の trigger を外して同じ行を同じSQLで用意する。
 */
async function prepare(create: () => Promise<D1Database>): Promise<D1Database> {
  const database = await create()
  const others = await database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND name != ?1")
    .bind(GUARD)
    .all<{ name: string }>()
  await database.batch([
    ...others.results.map((trigger) => database.prepare(`DROP TRIGGER "${trigger.name}"`)),
    database
      .prepare(
        `INSERT INTO system_accounts (id, status, token_version, created_at, updated_at)
         VALUES (?1, 'active', 0, 0, 0), (?2, 'active', 0, 0, 0)`,
      )
      .bind(ids.actor, ids.otherActor),
    database
      .prepare(
        `INSERT OR IGNORE INTO company_organizations (id, revision, created_at, updated_at)
         VALUES (?1, 0, 0, 0)`,
      )
      .bind(COMPANY_DEFAULT_ORGANIZATION_ID),
    database
      .prepare("UPDATE company_organizations SET revision = ?2 WHERE id = ?1")
      .bind(COMPANY_DEFAULT_ORGANIZATION_ID, ORGANIZATION_REVISION),
    database
      .prepare(
        `INSERT INTO company_employees (id, official_name, created_at, updated_at)
         VALUES (?1, 'Employee', 0, 0)`,
      )
      .bind(ids.employee),
    database
      .prepare(
        `INSERT INTO company_employments
           (id, employee_id, contract_name, employment_type, hire_date, status, created_at, updated_at)
         VALUES (?1, ?2, 'Contract', 'FULL_TIME', '2030-01-01', 'ACTIVE', 0, 0)`,
      )
      .bind(ids.employment, ids.employee),
    database
      .prepare("INSERT INTO company_organization_units (id, created_at) VALUES (?1, 0)")
      .bind(ids.unit),
  ])
  return database
}

/**
 * 責務の接続が1つのbatchで保存する行のうち guard が読む行を入れ、最後の証跡の保存だけを試す。
 * 証跡より前の行は保存に成功させ、証跡の保存を guard が拒否したときだけその失敗を返す。
 */
async function connect(database: D1Database, name: string, connection: Connection) {
  const operationId = deterministicCompanyId("test-adoption-guard", name, "operation")
  const periodId = deterministicCompanyId("test-adoption-guard", name, "period")
  const resourceId = deterministicCompanyId("test-adoption-guard", name, "resource")
  const confirmed =
    connection.target === "existing"
      ? [
          { resourceId, revision: 1 },
          { resourceId, revision: 2 },
        ]
      : []
  const resourceRevision = confirmed.length + 1
  const attributes = JSON.stringify({
    responsibilityId: "responsibility:manager",
    authorityScopeId: "scope:team",
    holderType: "employee",
    holderId: ids.employee,
    delegationAllowed: false,
  })
  const revision = (
    resourceRevisionNumber: number,
    organizationRevision: number,
    actorAccountId: string,
    reason: string,
  ) =>
    database
      .prepare(
        `INSERT INTO company_resource_revisions
           (organization_id, resource_type, resource_id, revision, organization_revision,
            state, effective_from, attributes_json, command_id, actor_account_id, reason, recorded_at)
         VALUES (?1, 'responsibility-assignment', ?2, ?3, ?4, 'active', '2030-01-01', ?5, ?6, ?7, ?8, 0)`,
      )
      .bind(
        COMPANY_DEFAULT_ORGANIZATION_ID,
        resourceId,
        resourceRevisionNumber,
        organizationRevision,
        attributes,
        `${name}:${resourceRevisionNumber}`,
        actorAccountId,
        reason,
      )
  await database.batch([
    database
      .prepare(
        `INSERT INTO company_organization_change_operations
           (id, expected_revision, change_count, applied_count, resulting_revision, status,
            recorded_at, actor_account_id, reason)
         VALUES (?1, 0, 1, 1, 1, 'PENDING', 0, ?2, ?3)`,
      )
      .bind(operationId, ids.actor, REASON),
    database
      .prepare(
        `INSERT INTO company_organization_responsibility_period_versions
           (period_id, revision, employee_id, employment_id, organization_unit_id,
            responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
         VALUES (?1, 1, ?2, ?3, ?4, 'MANAGER', '2030-01-01', NULL, 0, ?5, 0)`,
      )
      .bind(periodId, ids.employee, ids.employment, ids.unit, operationId),
    ...confirmed.map((entry) =>
      revision(entry.revision, entry.revision, ids.otherActor, "Define responsibility"),
    ),
    revision(
      resourceRevision,
      ORGANIZATION_REVISION,
      connection.appliedActorAccountId ?? ids.actor,
      connection.appliedReason ?? REASON,
    ),
    database
      .prepare(
        `INSERT INTO company_responsibility_resource_bindings
           (resource_id, organization_id, employee_id, employment_id, organization_unit_id,
            responsibility_type, responsibility_id, authority_scope_id, resource_revision, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'MANAGER', 'responsibility:manager', 'scope:team', ?6, 0)`,
      )
      .bind(
        resourceId,
        COMPANY_DEFAULT_ORGANIZATION_ID,
        ids.employee,
        ids.employment,
        ids.unit,
        resourceRevision,
      ),
    database
      .prepare(
        `INSERT INTO company_responsibility_period_bindings
           (period_id, resource_id, period_revision, source_revision)
         VALUES (?1, ?2, 1, ?3)`,
      )
      .bind(periodId, resourceId, resourceRevision),
  ])
  const mapping: Mapping = {
    periodId,
    responsibilityId: "responsibility:manager",
    authorityScopeId: "scope:team",
    ...(connection.target === "existing" ? { existingResourceId: resourceId } : {}),
  }
  const digest = deterministicCompanyId("test-adoption-guard", name, "digest").replaceAll("-", "")
  return database
    .prepare(
      `INSERT INTO company_responsibility_resource_adoptions
         (command_id, operation_id, employee_id, fingerprint, actor_account_id, reason,
          expected_revision, organization_revision, observed_on, snapshot_digest, source_json,
          mappings_json, recorded_at, adopted_periods)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, '2030-01-01', ?9, ?10, ?11, 0, 1)`,
    )
    .bind(
      name,
      operationId,
      ids.employee,
      "a".repeat(64),
      ids.actor,
      REASON,
      EXPECTED_REVISION,
      ORGANIZATION_REVISION,
      digest.repeat(2),
      JSON.stringify(
        connection.toConfirmed === undefined
          ? {
              publicResponsibilities: confirmed.map((entry) => ({
                ...entry,
                bindingEmployeeId: null,
              })),
            }
          : connection.toConfirmed(confirmed),
      ),
      JSON.stringify([connection.toMapping?.(mapping, resourceId) ?? mapping]),
    )
    .run()
    .then(
      () => null,
      (cause: unknown) => cause,
    )
}

type Case = { name: string; connection: Connection }

const accepted: Case[] = [
  { name: "新しい責務への接続", connection: { target: "new" } },
  { name: "既存の責務の revision 2 から 3 への接続", connection: { target: "existing" } },
]

const rejected: Case[] = [
  {
    name: "新しい責務の改訂を別の主体が保存した証跡",
    connection: { target: "new", appliedActorAccountId: ids.otherActor },
  },
  {
    name: "新しい責務の改訂を別の理由で保存した証跡",
    connection: { target: "new", appliedReason: "Another reason" },
  },
  {
    name: "既存の責務の改訂を別の主体が保存した証跡",
    connection: { target: "existing", appliedActorAccountId: ids.otherActor },
  },
  {
    name: "既存の責務の改訂を別の理由で保存した証跡",
    connection: { target: "existing", appliedReason: "Another reason" },
  },
  {
    name: "接続先を別の責務へ書き換えた証跡",
    connection: {
      target: "existing",
      toMapping: (mapping) => ({ ...mapping, existingResourceId: ids.unrelatedResource }),
    },
  },
  {
    name: "既存の責務への接続から接続先を消した証跡",
    connection: {
      target: "existing",
      toMapping: (mapping) => ({
        periodId: mapping.periodId,
        responsibilityId: mapping.responsibilityId,
        authorityScopeId: mapping.authorityScopeId,
      }),
    },
  },
  {
    name: "新しい責務を既存の責務への接続と偽った証跡",
    connection: {
      target: "new",
      toMapping: (mapping, resourceId) => ({ ...mapping, existingResourceId: resourceId }),
    },
  },
  {
    name: "確認済みの公開責務を消した証跡",
    connection: { target: "existing", toConfirmed: () => ({}) },
  },
  {
    name: "確認済みの公開責務の改訂を減らした証跡",
    connection: {
      target: "existing",
      toConfirmed: (confirmed) => ({
        publicResponsibilities: confirmed
          .filter((entry) => entry.revision === 1)
          .map((entry) => ({ ...entry, bindingEmployeeId: null })),
      }),
    },
  },
]

test("責務の接続の証跡を守る guard の定義は、共有SQLとmigrationで一致する", async () => {
  const [shared, migrated] = await Promise.all(
    fixtures.map(async (entry) => readGuard(await entry.create())),
  )
  expect(shared).toBeString()
  expect(shared).toBe(migrated ?? null)
})

describe.each(fixtures)("$fixture の責務の接続の証跡", ({ create }) => {
  let prepared: Promise<D1Database> | undefined
  const database = () => (prepared ??= prepare(create))

  test.each(accepted)("$name を受理する", async ({ name, connection }) => {
    const db = await database()
    expect(await connect(db, name, connection)).toBeNull()
    expect(
      await db
        .prepare(
          "SELECT count(*) AS saved FROM company_responsibility_resource_adoptions WHERE command_id = ?1",
        )
        .bind(name)
        .first<number>("saved"),
    ).toBe(1)
  })

  test.each(rejected)("$name を拒否する", async ({ name, connection }) => {
    const db = await database()
    const rejection = await connect(db, name, connection)
    expect(rejection).toBeInstanceOf(Error)
    expect(String(rejection)).toContain(REJECTION)
    expect(
      await db
        .prepare(
          "SELECT count(*) AS saved FROM company_responsibility_resource_adoptions WHERE command_id = ?1",
        )
        .bind(name)
        .first<number>("saved"),
    ).toBe(0)
  })
})
