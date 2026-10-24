import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { hc } from "hono/client"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import * as adoptions from "@/contexts/company/interface/routes/company.responsibility-resource-adoptions"
import { ResponsibilityResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/responsibility-resource-adoption-snapshot.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyGovernanceAuthorityResolutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-governance-authority-resolution.adapter"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { COMPANY_TEST_MIGRATIONS_DIR } from "@/contexts/company/test/migrations-directory.test-support"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { prepareHistoricalCompanyResourceRevisionFixture } from "@/contexts/company/test/historical-company-resource-revision.test-support"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

/** 期間と公開資源の ID は UUID の制約を満たす固定値にする。 */
const fixtureIds = {
  legacyOne: deterministicCompanyId("test-responsibility", "responsibility:legacy-one"),
  legacyTwo: deterministicCompanyId("test-responsibility", "responsibility:legacy-two"),
  legacyPeople: deterministicCompanyId("test-responsibility", "responsibility:legacy-people"),
  legacyCancelled: deterministicCompanyId("test-responsibility", "responsibility:legacy-cancelled"),
  existingResponsibility: deterministicCompanyId("test-responsibility", "existing:responsibility"),
  existingManager: deterministicCompanyId("test-responsibility", "existing:manager"),
  independent: deterministicCompanyId("test-responsibility", "responsibility:independent"),
  missingResponsibility: deterministicCompanyId("test-responsibility", "missing:responsibility"),
  differentTarget: deterministicCompanyId("test-responsibility", "different:target"),
  unknownPeriod: deterministicCompanyId("test-responsibility", "period:unknown"),
}

function resourceProps(resource: CompanyResourceEntity): CompanyResourceProps {
  return {
    organizationId: resource.organizationId,
    type: resource.type,
    id: resource.id,
    revision: resource.revision,
    state: resource.state,
    effectiveFrom: resource.effectiveFrom,
    effectiveTo: resource.effectiveTo,
    attributes: resource.attributes,
  }
}

async function fixture(
  databaseOverride?: D1Database,
  organizationHistory: "initialization" | "confirmed" = "initialization",
) {
  const base = await createCompanyAssignmentResourceTestContext(
    databaseOverride,
    organizationHistory,
  )
  await base.initializeAssignment()
  const repository = new D1CompanyResourceRepository({ database: base.database })
  const define = async (
    resources: ReadonlyArray<CompanyResourceProps>,
    key: string = crypto.randomUUID(),
  ) => {
    const change = CompanyResourceChangeEntity.create({
      commandId: key,
      expectedRevision: await base.companyRevision(),
      actorAccountId: base.creator.accountId,
      recordedAt: base.at.getTime(),
      reason: "Confirm responsibility definitions",
      resources,
    })
    if (change instanceof Error) throw change
    return repository.write(change)
  }
  const envelope = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    revision: 1,
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  }
  const definitions: CompanyResourceProps[] = [
    {
      ...envelope,
      type: "responsibility",
      id: "responsibility:manager",
      attributes: { code: "MANAGER", officialName: "Manager" },
    },
    {
      ...envelope,
      type: "responsibility",
      id: "responsibility:people",
      attributes: { code: "PEOPLE_OPERATIONS", officialName: "People Operations" },
    },
    {
      ...envelope,
      type: "authority-scope",
      id: "scope:team",
      attributes: {
        scopeType: "organization-unit",
        scopeId: "0190005f-0000-7000-8000-3e026079e0b5",
      },
    },
    {
      ...envelope,
      type: "authority-scope",
      id: "scope:root",
      attributes: { scopeType: "organization-unit", scopeId: base.root.id },
    },
  ]
  expect(await define(definitions)).toMatchObject({ kind: "applied" })
  const original = [
    {
      id: fixtureIds.legacyOne,
      revision: 1,
      type: "MANAGER",
      startsOn: "2030-01-01",
      endsOn: null,
      isVoid: 0,
    },
    {
      id: fixtureIds.legacyOne,
      revision: 2,
      type: "MANAGER",
      startsOn: "2030-02-01",
      endsOn: "2030-04-01",
      isVoid: 0,
    },
    {
      id: fixtureIds.legacyTwo,
      revision: 1,
      type: "MANAGER",
      startsOn: "2030-06-01",
      endsOn: "2030-09-01",
      isVoid: 0,
    },
    {
      id: fixtureIds.legacyPeople,
      revision: 1,
      type: "PEOPLE_OPERATIONS",
      startsOn: "2030-03-01",
      endsOn: null,
      isVoid: 0,
    },
    {
      id: fixtureIds.legacyCancelled,
      revision: 1,
      type: "MANAGER",
      startsOn: "2030-10-01",
      endsOn: null,
      isVoid: 1,
    },
  ]
  const revision = await base.database
    .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
    .first<number>("revision")
  await base.database.batch([
    base.database
      .prepare(`INSERT INTO company_organization_change_operations
      (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason)
      VALUES ('87dc7df9-5a3e-4d81-9c8a-3ed616c8b120', ?1, 5, 0, ?1 + 5, 'PENDING', 0, ?2, 'Record original responsibility history')`)
      .bind(revision, base.creator.accountId),
    ...original.map((period) =>
      base.database
        .prepare(`INSERT INTO company_organization_responsibility_period_versions
      (period_id, revision, employee_id, employment_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES (?1, ?2, ?3, ?4, '0190005f-0000-7000-8000-3e026079e0b5', ?5, ?6, ?7, ?8, '87dc7df9-5a3e-4d81-9c8a-3ed616c8b120', 0)`)
        .bind(
          period.id,
          period.revision,
          base.creator.employeeId,
          base.assignment.attributes.employmentId,
          period.type,
          period.startsOn,
          period.endsOn,
          period.isVoid,
        ),
    ),
    base.database.prepare(
      "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = '87dc7df9-5a3e-4d81-9c8a-3ed616c8b120'",
    ),
  ])
  let actor: CompanyActorValue | undefined = CompanyActorValue.restore({
    ...base.creator,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:admin"],
  })
  const clock = { now: base.at }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    if (actor !== undefined) context.set("companyActor", actor)
    context.set("companyClock", () => clock.now)
    context.set("database", base.context.var.database)
    context.set("auditContext", base.context.var.auditContext)
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    return context.json({ code: error.code }, error.status)
  })
  const routes = app
    .get("/company/responsibility-resource-adoptions", ...adoptions.GET)
    .post("/company/responsibility-resource-adoptions", ...adoptions.POST)
  const client = hc<typeof routes>("http://localhost", {
    fetch: Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        routes.request(input, init, base.context.env),
      { preconnect: fetch.preconnect },
    ),
  })
  const get = (employeeId: string = base.creator.employeeId) =>
    client.company["responsibility-resource-adoptions"].$get({ query: { employee_id: employeeId } })
  const preview = async () => {
    const response = await get()
    expect(Number(response.status)).toBe(200)
    return z
      .object({
        expectedRevision: z.number(),
        snapshotDigest: z.string(),
        observedOn: z.string(),
        snapshot: z.object({ periods: z.array(z.unknown()) }),
      })
      .parse(await response.json())
  }
  const first = await preview()
  const body = {
    employeeId: base.creator.employeeId,
    expectedRevision: first.expectedRevision,
    snapshotDigest: first.snapshotDigest,
    observedOn: first.observedOn,
    reason: "Confirm original responsibility history and definitions",
    mappings: [...new Map(original.map((period) => [period.id, period])).values()].map(
      (period) => ({
        periodId: period.id,
        responsibilityId:
          period.type === "MANAGER" ? "responsibility:manager" : "responsibility:people",
        authorityScopeId: "scope:team",
      }),
    ),
  }
  const adopt = (key = "responsibility:adopt", input = body) =>
    client.company["responsibility-resource-adoptions"].$post({
      header: { "idempotency-key": key },
      json: input,
    })
  const publicOn = async (date: string) => {
    const snapshot = await repository.findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["responsibility-assignment"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!snapshot.ok) throw snapshot.cause
    return snapshot.resources.filter(
      (resource) => resource.readText("holderId") === base.creator.employeeId,
    )
  }
  const state = async () => ({
    base: await base.persisted(),
    responsibility: (
      await base.database
        .prepare(
          "SELECT * FROM company_organization_responsibility_period_versions ORDER BY period_id, revision",
        )
        .all()
    ).results,
    sources: (
      await base.database
        .prepare("SELECT * FROM company_responsibility_resource_bindings ORDER BY resource_id")
        .all()
    ).results,
    bindings: (
      await base.database
        .prepare("SELECT * FROM company_responsibility_period_bindings ORDER BY period_id")
        .all()
    ).results,
    receipts: (
      await base.database
        .prepare("SELECT * FROM company_responsibility_resource_adoptions ORDER BY command_id")
        .all()
    ).results,
  })
  return {
    ...base,
    repository,
    definitions,
    define,
    first,
    body,
    adopt,
    get,
    preview,
    publicOn,
    state,
    clock,
    setAdoptionActor: (next: CompanyActorValue | undefined) => {
      actor = next
    },
  }
}

test("移行の確認対象に既存公開責務の全版と来歴を含め、確認後の変更を拒否する", async () => {
  const f = await fixture()
  const existing: CompanyResourceProps = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "responsibility-assignment",
    id: fixtureIds.existingResponsibility,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2030-02-01"),
    effectiveTo: restoreCalendarDate("2030-04-01"),
    attributes: {
      responsibilityId: "responsibility:manager",
      authorityScopeId: "scope:team",
      holderType: "employee",
      holderId: f.creator.employeeId,
      delegationAllowed: false,
    },
  }
  expect(await f.define([existing], "existing:initial")).toMatchObject({ kind: "applied" })
  const adapter = new ResponsibilityResourceAdoptionSnapshotAdapter(f.database)
  const before = await adapter.find(f.creator.employeeId)
  if (before === null || before instanceof Error) throw new Error("snapshot missing")
  expect(before.props.value.publicResponsibilities).toMatchObject([
    {
      resourceId: existing.id,
      revision: 1,
      commandId: "existing:initial",
      bindingEmployeeId: null,
    },
  ])
  expect(
    await f.define([{ ...existing, revision: 2, state: "void" }], "existing:cancel"),
  ).toMatchObject({ kind: "applied" })
  const after = await adapter.find(f.creator.employeeId)
  if (after === null || after instanceof Error) throw new Error("snapshot missing")
  expect(
    after.props.value.publicResponsibilities.map((entry) => ({
      revision: entry.revision,
      state: entry.state,
    })),
  ).toEqual([
    { revision: 1, state: "active" },
    { revision: 2, state: "void" },
  ])
  expect(after.props.digest).not.toBe(before.props.digest)
  const guarded = await f.database
    .batch([adapter.prepareGuard(before)])
    .catch((cause: unknown) => cause)
  expect(guarded).toBeInstanceOf(Error)
})

test.each([false, true])(
  "複数の旧期間を既存責務へ統合し、失敗と再送でもID・履歴を保全する: %s",
  async (failReceipt) => {
    const f = await fixture()
    const existing: CompanyResourceProps = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "responsibility-assignment",
      id: fixtureIds.existingManager,
      revision: 1,
      state: "active",
      effectiveFrom: restoreCalendarDate("2030-02-01"),
      effectiveTo: restoreCalendarDate("2030-04-01"),
      attributes: {
        responsibilityId: "responsibility:manager",
        authorityScopeId: "scope:team",
        holderType: "employee",
        holderId: f.creator.employeeId,
        delegationAllowed: false,
      },
    }
    expect(await f.define([existing], "existing:first")).toMatchObject({ kind: "applied" })
    expect(
      await f.define(
        [
          {
            ...existing,
            revision: 2,
            effectiveFrom: restoreCalendarDate("2030-06-01"),
            effectiveTo: restoreCalendarDate("2030-09-01"),
          },
        ],
        "existing:second",
      ),
    ).toMatchObject({ kind: "applied" })
    const preview = await f.preview()
    const input = {
      ...f.body,
      expectedRevision: preview.expectedRevision,
      snapshotDigest: preview.snapshotDigest,
      mappings: f.body.mappings.map((mapping) => ({
        ...mapping,
        ...([fixtureIds.legacyOne, fixtureIds.legacyTwo].includes(mapping.periodId)
          ? { existingResourceId: existing.id }
          : {}),
      })),
    }
    const before = await f.state()
    const original = (
      await f.database
        .prepare(
          "SELECT * FROM company_resource_revisions WHERE resource_id = ?1 ORDER BY revision",
        )
        .bind(existing.id)
        .all()
    ).results
    for (const mappings of [
      input.mappings.map((mapping) => ({
        ...mapping,
        existingResourceId: fixtureIds.missingResponsibility,
      })),
      input.mappings.map((mapping) => ({
        ...mapping,
        existingResourceId: mapping.periodId === fixtureIds.legacyOne ? existing.id : undefined,
      })),
      input.mappings.map((mapping) => ({ ...mapping, authorityScopeId: "scope:root" })),
    ]) {
      expect(Number((await f.adopt("existing:invalid", { ...input, mappings })).status)).toBe(422)
      expect(await f.state()).toEqual(before)
    }
    for (const replacement of [
      {
        placeholder: "?12",
        expression: `json_set(?12, '$[0].existingResourceId', '${fixtureIds.differentTarget}')`,
      },
      { placeholder: "?12", expression: "json_remove(?12, '$[0].existingResourceId')" },
      { placeholder: "?11", expression: "json_remove(?11, '$.publicResponsibilities')" },
    ]) {
      const prepare = f.database.prepare.bind(f.database)
      const interception = spyOn(f.database, "prepare").mockImplementation((sql) =>
        prepare(
          sql.startsWith("INSERT INTO company_responsibility_resource_adoptions")
            ? sql.replace(replacement.placeholder, replacement.expression)
            : sql,
        ),
      )
      try {
        expect(Number((await f.adopt("existing:corrupt-receipt", input)).status)).toBe(503)
      } finally {
        interception.mockRestore()
      }
      expect(await f.state()).toEqual(before)
    }
    if (failReceipt) {
      await execSql(
        f.database,
        "CREATE TRIGGER reject_existing_connection BEFORE INSERT ON company_responsibility_resource_adoptions BEGIN SELECT RAISE(ABORT, 'injected failure'); END;",
      )
      expect(Number((await f.adopt("existing:connect", input)).status)).toBe(503)
      expect(await f.state()).toEqual(before)
      await execSql(f.database, "DROP TRIGGER reject_existing_connection")
    }
    expect(Number((await f.adopt("existing:connect", input)).status)).toBe(201)
    expect(
      (
        await f.database
          .prepare(
            "SELECT * FROM company_resource_revisions WHERE resource_id = ?1 AND revision <= 2 ORDER BY revision",
          )
          .bind(existing.id)
          .all()
      ).results,
    ).toEqual(original)
    expect(
      (
        await f.database
          .prepare(
            "SELECT resource_id, resource_revision FROM company_responsibility_resource_bindings WHERE resource_id = ?1",
          )
          .bind(existing.id)
          .all()
      ).results,
    ).toEqual([{ resource_id: existing.id, resource_revision: 3 }])
    expect(
      (
        await f.database
          .prepare(
            "SELECT period_id, source_revision FROM company_responsibility_period_bindings WHERE resource_id = ?1 ORDER BY period_id",
          )
          .bind(existing.id)
          .all()
      ).results,
    ).toEqual(
      [
        { period_id: fixtureIds.legacyOne, source_revision: 3 },
        { period_id: fixtureIds.legacyTwo, source_revision: 3 },
      ].sort((left, right) => (left.period_id < right.period_id ? -1 : 1)),
    )
    expect(
      (await f.publicOn("2030-03-15")).filter((resource) => resource.id === existing.id),
    ).toHaveLength(1)
    expect(
      (await f.publicOn("2030-05-15")).filter((resource) => resource.id === existing.id),
    ).toHaveLength(0)
    expect(
      (await f.publicOn("2030-07-15")).filter((resource) => resource.id === existing.id),
    ).toHaveLength(1)
    const completed = await f.state()
    expect(Number((await f.adopt("existing:connect", input)).status)).toBe(200)
    expect(await f.state()).toEqual(completed)
    expect(
      await f.define(
        [
          {
            ...existing,
            revision: 4,
            effectiveFrom: restoreCalendarDate("2030-06-01"),
            effectiveTo: restoreCalendarDate("2030-08-01"),
          },
        ],
        "existing:shorten-after-connection",
      ),
    ).toMatchObject({ kind: "applied" })
    expect(
      (await f.publicOn("2030-08-15")).filter((resource) => resource.id === existing.id),
    ).toHaveLength(0)
    expect(
      (await f.publicOn("2030-03-15")).filter((resource) => resource.id === existing.id),
    ).toHaveLength(1)
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate("2030-06-15"),
        },
        "existing:retire-after-connection",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicOn("2030-06-16")).toHaveLength(0)
    expect((await f.database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
  },
)

test("新しい接続制約を適用しても旧制約で保存した移行証跡と再送結果を保全する", async () => {
  const f = await fixture()
  const previous = readdirSync(COMPANY_TEST_MIGRATIONS_DIR).find((file) =>
    file.endsWith("_record_company_responsibility_resource_adoptions.sql"),
  )
  const next = readdirSync(COMPANY_TEST_MIGRATIONS_DIR).find((file) =>
    file.endsWith("_connect_existing_company_responsibilities.sql"),
  )
  if (previous === undefined || next === undefined) throw new Error("migration missing")
  const previousSql = readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, previous), "utf8")
  const start = previousSql.indexOf(
    "DROP TRIGGER IF EXISTS company_responsibility_adoption_insert_guard;",
  )
  const end = previousSql.indexOf(
    "DROP TRIGGER IF EXISTS company_responsibility_adoption_update_guard;",
  )
  await f.database.batch(
    splitSqlStatements(previousSql.slice(start, end)).map((sql) => f.database.prepare(sql)),
  )
  expect(Number((await f.adopt()).status)).toBe(201)
  const before = await f.state()
  const migration = readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, next), "utf8")
  for (const application of [migration, migration]) {
    await f.database.batch(splitSqlStatements(application).map((sql) => f.database.prepare(sql)))
    expect(await f.state()).toEqual(before)
    expect(Number((await f.adopt()).status)).toBe(200)
  }
})

describe("確認済みの既存責務を公開履歴へ接続する", () => {
  test("全改訂・取消・空白を保持し、資格解決・公開更新・人事発令へ接続する", async () => {
    const f = await fixture()
    const before = await f.state()
    expect(f.first.snapshot.periods).toHaveLength(5)
    const response = await f.adopt()
    expect(await response.json()).toMatchObject({ adoptedPeriods: 4, replayed: false })
    expect(Number(response.status)).toBe(201)
    const saved = await f.state()
    expect(
      saved.responsibility
        .slice()
        .filter((row) => row.recorded_by_action_id === "87dc7df9-5a3e-4d81-9c8a-3ed616c8b120"),
    ).toEqual(before.responsibility)
    expect(saved.sources).toHaveLength(4)
    expect(Number((await f.adopt()).status)).toBe(200)
    expect(await f.state()).toEqual(saved)
    expect(await f.publicOn("2030-01-31")).toEqual([])
    expect(await f.publicOn("2030-02-01")).toHaveLength(1)
    expect(await f.publicOn("2030-04-01")).toHaveLength(1)
    expect(await f.publicOn("2030-06-01")).toHaveLength(2)
    expect(await f.publicOn("2030-10-01")).toHaveLength(1)
    const resolver = new CompanyGovernanceAuthorityResolutionAdapter({
      repository: f.repository,
      readActiveAccountIds: async (ids) => new Set(ids),
    })
    expect(
      await resolver.resolve({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        asOf: restoreCalendarDate("2030-06-01"),
        subjectEmployeeId: null,
        criteria: [
          {
            responsibilityCode: "MANAGER",
            scope: {
              scopeType: "organization-unit",
              scopeId: "0190005f-0000-7000-8000-3e026079e0b5",
            },
          },
        ],
      }),
    ).toMatchObject({
      kind: "resolved",
      resolution: { candidates: [{ employeeId: f.creator.employeeId }] },
    })
    const manager = (await f.publicOn("2030-02-01"))[0]
    if (manager === undefined) throw new Error("manager missing")
    const change = CompanyResourceEntity.create({
      ...resourceProps(manager),
      revision: 2,
      effectiveTo: restoreCalendarDate("2030-03-15"),
    })
    if (change instanceof Error) throw change
    expect(await f.define([change], "responsibility:public-after-adoption")).toMatchObject({
      kind: "applied",
    })
    expect(
      (await f.state()).responsibility
        .filter((row) => row.period_id === fixtureIds.legacyOne)
        .at(-1),
    ).toMatchObject({ ends_on: "2030-03-15" })
    const retired = await f.personnel(
      {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-06-15"),
      },
      "responsibility:retire-after-adoption",
    )
    if (retired instanceof Error) throw retired
    expect(await f.publicOn("2030-06-16")).toEqual([])
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: retired.action.id,
          eventOn: restoreCalendarDate("2030-06-15"),
          reason: "Confirm retirement date",
          replacementAction: {
            kind: "retired",
            employeeCode: "EMPLOYEE-001",
            retirementOn: restoreCalendarDate("2030-06-20"),
          },
        },
        "responsibility:correct-after-adoption",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.publicOn("2030-06-20")).toHaveLength(2)
    expect(await f.publicOn("2030-06-21")).toEqual([])
    expect((await f.database.prepare("PRAGMA foreign_key_check").all()).results).toEqual([])
    const receipt = await f.database
      .prepare("SELECT source_json, mappings_json FROM company_responsibility_resource_adoptions")
      .first<{ source_json: string; mappings_json: string }>()
    if (receipt === null) throw new Error("receipt missing")
    expect(JSON.parse(receipt.source_json).periods).toEqual(f.first.snapshot.periods)
    expect(JSON.parse(receipt.mappings_json)).toEqual(f.body.mappings)
  })

  test("証跡の保存失敗では全取消し、同じ依頼を再試行して一度だけ接続する", async () => {
    const f = await fixture()
    const before = await f.state()
    await execSql(
      f.database,
      "CREATE TRIGGER reject_responsibility_adoption BEFORE INSERT ON company_responsibility_resource_adoptions BEGIN SELECT RAISE(ABORT, 'injected failure'); END;",
    )
    expect(Number((await f.adopt()).status)).toBe(503)
    expect(await f.state()).toEqual(before)
    await execSql(f.database, "DROP TRIGGER reject_responsibility_adoption")
    expect(Number((await f.adopt()).status)).toBe(201)
    const saved = await f.state()
    expect(Number((await f.adopt()).status)).toBe(200)
    expect(await f.state()).toEqual(saved)
    for (const sql of [
      "UPDATE company_responsibility_resource_adoptions SET reason = 'Changed'",
      "DELETE FROM company_responsibility_resource_adoptions",
    ]) {
      expect(
        await f.database
          .prepare(sql)
          .run()
          .catch((cause: unknown) => cause),
      ).toBeInstanceOf(Error)
    }
    expect(await f.state()).toEqual(saved)
  })
})

test("同時再送は一度だけ接続し、別の依頼・別の主体・キーの再利用を拒否する", async () => {
  const f = await fixture()
  const responses = await Promise.all([f.adopt(), f.adopt()])
  expect(responses.map((response) => Number(response.status)).sort((a, b) => a - b)).toEqual([
    200, 201,
  ])
  const before = await f.state()
  expect(
    Number(
      (await f.adopt("responsibility:adopt", { ...f.body, reason: "Different confirmation" }))
        .status,
    ),
  ).toBe(409)
  f.setAdoptionActor(
    CompanyActorValue.restore({
      ...f.people[1]!,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:admin"],
    }),
  )
  expect(Number((await f.adopt()).status)).toBe(409)
  expect(await f.state()).toEqual(before)
})

test("冪等キーが違う同時の移行依頼は後から来た方を拒否する", async () => {
  const other = await fixture()
  expect(
    (await Promise.all([other.adopt("responsibility:first"), other.adopt("responsibility:second")]))
      .map((response) => Number(response.status))
      .sort((a, b) => a - b),
  ).toEqual([201, 409])
  expect((await other.state()).receipts).toHaveLength(1)
})

test("保存直前の会社版変更を拒否し、再確認した同じキーで接続する", async () => {
  const f = await fixture()
  const reader = new ResponsibilityResourceAdoptionSnapshotAdapter(f.database)
  const guard = reader.prepareGuard.bind(reader)
  const originalBatch = f.database.batch.bind(f.database)
  const interception = spyOn(
    ResponsibilityResourceAdoptionSnapshotAdapter.prototype,
    "prepareGuard",
  ).mockImplementationOnce((snapshot) => {
    const statement = guard(snapshot)
    spyOn(f.database, "batch").mockImplementationOnce(async (statements) => {
      await f.assignEmployeeCode(f.people[1]!.employeeId, "CONFIRMED-MANAGER")
      return originalBatch(statements)
    })
    return statement
  })
  try {
    expect(Number((await f.adopt()).status)).toBe(409)
  } finally {
    interception.mockRestore()
  }
  const before = await f.state()
  expect(before.receipts).toEqual([])
  expect(before.sources).toEqual([])
  expect(Number((await f.adopt()).status)).toBe(409)
  const next = await f.preview()
  expect(
    Number(
      (
        await f.adopt("responsibility:adopt", {
          ...f.body,
          expectedRevision: next.expectedRevision,
          snapshotDigest: next.snapshotDigest,
          observedOn: next.observedOn,
        })
      ).status,
    ),
  ).toBe(201)
})

test("DB確定後に応答を失っても保存済みの証跡から結果を復元する", async () => {
  const f = await fixture()
  const batch = f.database.batch.bind(f.database)
  let lost = false
  const interception = spyOn(f.database, "batch").mockImplementation(
    async <T>(statements: D1PreparedStatement[]) => {
      const result = await batch<T>(statements)
      const receipt = await f.database
        .prepare(
          "SELECT command_id FROM company_responsibility_resource_adoptions WHERE command_id = 'responsibility:adopt'",
        )
        .first()
      if (!lost && receipt !== null) {
        lost = true
        throw new Error("response lost after commit")
      }
      return result
    },
  )
  try {
    const response = await f.adopt()
    expect(Number(response.status)).toBe(200)
    expect(await response.json()).toMatchObject({ adoptedPeriods: 4, replayed: true })
  } finally {
    interception.mockRestore()
  }
  expect(lost).toBe(true)
  const saved = await f.state()
  expect(saved.receipts).toHaveLength(1)
  expect(Number((await f.adopt()).status)).toBe(200)
  expect(await f.state()).toEqual(saved)
})

test.each([
  "missing-period",
  "duplicate-period",
  "unknown-period",
  "wrong-code",
  "wrong-scope",
  "unknown-definition",
])("確認した期間と定義の対応が一致しない依頼を拒否する: %s", async (kind) => {
  const f = await fixture()
  const mappings = f.body.mappings.map((mapping) => ({ ...mapping }))
  const first = mappings[0]
  if (first === undefined) throw new Error("mapping missing")
  if (kind === "missing-period") mappings.pop()
  if (kind === "duplicate-period") mappings[1] = { ...first }
  if (kind === "unknown-period") first.periodId = fixtureIds.unknownPeriod
  if (kind === "wrong-code") first.responsibilityId = "responsibility:people"
  if (kind === "wrong-scope") first.authorityScopeId = "scope:root"
  if (kind === "unknown-definition") first.responsibilityId = "responsibility:missing"
  const before = await f.state()
  expect(Number((await f.adopt("responsibility:invalid", { ...f.body, mappings })).status)).toBe(
    422,
  )
  expect(await f.state()).toEqual(before)
})

test.each(["anonymous", "reader", "other-organization"])(
  "確認・接続・再送は現在の管理資格と会社を検査する: %s",
  async (kind) => {
    const f = await fixture()
    expect(Number((await f.adopt()).status)).toBe(201)
    const before = await f.state()
    f.setAdoptionActor(
      kind === "anonymous"
        ? undefined
        : CompanyActorValue.restore({
            ...f.creator,
            organizationIds: [
              kind === "other-organization"
                ? "01900060-0000-7000-8000-12268fccf2cc"
                : COMPANY_DEFAULT_ORGANIZATION_ID,
            ],
            capabilities: [kind === "reader" ? "company:read" : "company:admin"],
          }),
    )
    const status = kind === "anonymous" ? 401 : 403
    expect(Number((await f.get()).status)).toBe(status)
    expect(Number((await f.adopt()).status)).toBe(status)
    expect(await f.state()).toEqual(before)
  },
)

test("確認日の違いと不正な時計を拒否し、履歴の欠落を補完しない", async () => {
  const f = await fixture()
  const before = await f.state()
  expect(Number((await f.get("employee:missing")).status)).toBe(404)
  expect(
    Number(
      (await f.adopt("responsibility:wrong-date", { ...f.body, observedOn: "2035-01-01" })).status,
    ),
  ).toBe(409)
  const now = f.clock.now
  f.clock.now = new Date("invalid")
  expect(Number((await f.get()).status)).toBe(503)
  expect(Number((await f.adopt()).status)).toBe(503)
  expect(await f.state()).toEqual(before)
  f.clock.now = now
  await execSql(
    f.database,
    "DROP TRIGGER company_organization_responsibility_period_versions_immutable_delete",
  )
  await f.database
    .prepare(
      `DELETE FROM company_organization_responsibility_period_versions WHERE period_id = '${fixtureIds.legacyOne}' AND revision = 1`,
    )
    .run()
  const broken = await f.preview()
  const brokenState = await f.state()
  expect(
    Number(
      (await f.adopt("responsibility:broken", { ...f.body, snapshotDigest: broken.snapshotDigest }))
        .status,
    ),
  ).toBe(422)
  expect(await f.state()).toEqual(brokenState)
})

test("最新状態が取消でも過去の責務との重複を拒否し、隣接する任用は許可する", async () => {
  const f = await fixture()
  expect(Number((await f.adopt()).status)).toBe(201)
  const original = (await f.publicOn("2030-02-15"))[0]
  if (original === undefined) throw new Error("responsibility missing")
  expect(
    await f.define(
      [
        {
          ...resourceProps(original),
          revision: 2,
          state: "void",
          effectiveFrom: restoreCalendarDate("2030-03-01"),
          effectiveTo: null,
        },
      ],
      "responsibility:future-void",
    ),
  ).toMatchObject({ kind: "applied" })
  const before = await f.state()
  const next = {
    ...resourceProps(original),
    id: fixtureIds.independent,
    revision: 1,
    effectiveFrom: restoreCalendarDate("2030-02-15"),
    effectiveTo: restoreCalendarDate("2030-03-15"),
  }
  expect(await f.define([next], "responsibility:historical-overlap")).toMatchObject({
    kind: "invalid",
  })
  expect(await f.state()).toEqual(before)
  expect(
    await f.define(
      [{ ...next, effectiveFrom: restoreCalendarDate("2030-03-01") }],
      "responsibility:adjacent",
    ),
  ).toMatchObject({ kind: "applied" })
})

test("既存の期間重複があるmigrationは一意制約を置換する前に停止する", async () => {
  const files = readdirSync(COMPANY_TEST_MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
  const migration = files.find((file) =>
    file.endsWith("_record_company_responsibility_resource_adoptions.sql"),
  )
  if (migration === undefined) throw new Error("responsibility adoption migration missing")
  const database = await createLocalD1Database({
    schema: files
      .filter((file) => file < migration)
      .map((file) => readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, file), "utf8"))
      // 旧schemaに存在した確認済み組織を用意し、後年の初期確認処理を実行しない。
      .join("\n")
      .replaceAll("initialization:organization:default", "fixture:confirmed-organization")
      .replaceAll("initialization:company:root", "fixture:confirmed-organization")
      .replaceAll("system:initialization", "fixture:organization-recorder"),
  })
  await prepareHistoricalCompanyResourceRevisionFixture(database)
  const f = await fixture(database, "confirmed")
  const responsibility: CompanyResourceProps = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "responsibility-assignment",
    id: "overlap:first",
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
    attributes: {
      responsibilityId: "responsibility:manager",
      holderType: "employee",
      holderId: f.creator.employeeId,
      authorityScopeId: "scope:team",
      delegationAllowed: false,
    },
  }
  expect(await f.define([responsibility])).toMatchObject({ kind: "applied" })
  expect(
    await f.define([
      {
        ...responsibility,
        revision: 2,
        state: "void",
        effectiveFrom: restoreCalendarDate("2030-12-01"),
      },
    ]),
  ).toMatchObject({ kind: "applied" })
  expect(
    await f.define([
      { ...responsibility, id: "overlap:second", effectiveFrom: restoreCalendarDate("2030-06-01") },
    ]),
  ).toMatchObject({ kind: "applied" })
  const before = await f.persisted()
  const migrated = await database
    .batch(
      splitSqlStatements(readFileSync(join(COMPANY_TEST_MIGRATIONS_DIR, migration), "utf8")).map(
        (sql) => database.prepare(sql),
      ),
    )
    .catch((cause: unknown) => cause)
  expect(migrated).toBeInstanceOf(Error)
  expect(await f.persisted()).toEqual(before)
  expect(
    await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'company_active_responsibility_assignment_uniq'",
      )
      .first(),
  ).not.toBeNull()
  expect(
    await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'company_responsibility_resource_adoptions'",
      )
      .first(),
  ).toBeNull()
})

test("期間との接続を欠く保存はDBで拒否し、移行証跡を残さない", async () => {
  const f = await fixture()
  const before = await f.state()
  const prepare = f.database.prepare.bind(f.database)
  const interception = spyOn(f.database, "prepare").mockImplementation((sql) =>
    prepare(
      sql.startsWith("INSERT INTO company_responsibility_period_bindings")
        ? "SELECT ?1, ?2, ?3"
        : sql,
    ),
  )
  try {
    expect(Number((await f.adopt()).status)).toBe(503)
  } finally {
    interception.mockRestore()
  }
  expect(await f.state()).toEqual(before)
  expect(Number((await f.adopt()).status)).toBe(201)
})

test("接続先の定義が責務の全期間を覆わない場合は全体を拒否する", async () => {
  const f = await fixture()
  const scope = f.definitions.find((resource) => resource.id === "scope:team")
  if (scope === undefined) throw new Error("scope missing")
  expect(
    await f.define([{ ...scope, revision: 2, effectiveTo: restoreCalendarDate("2030-04-01") }]),
  ).toMatchObject({ kind: "applied" })
  const preview = await f.preview()
  const before = await f.state()
  expect(
    Number(
      (
        await f.adopt("responsibility:outside-definition", {
          ...f.body,
          expectedRevision: preview.expectedRevision,
          snapshotDigest: preview.snapshotDigest,
        })
      ).status,
    ),
  ).toBe(422)
  expect(await f.state()).toEqual(before)
})

test("百件を超える責務を一括で接続し、後半の失敗でも先頭から取り消す", async () => {
  const f = await fixture()
  const revision = await f.database
    .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
    .first<number>("revision")
  const periods = Array.from({ length: 101 }, (_, index) => ({
    id: deterministicCompanyId("test-responsibility", `bulk-${String(index).padStart(3, "0")}`),
    startsOn: new Date(Date.UTC(2031, 0, 1 + index * 2)).toISOString().slice(0, 10),
    endsOn: new Date(Date.UTC(2031, 0, 2 + index * 2)).toISOString().slice(0, 10),
  }))
  await f.database.batch([
    f.database
      .prepare(`INSERT INTO company_organization_change_operations
      (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at, actor_account_id, reason)
      VALUES ('842191ae-a0cd-4b53-a8a0-570d75957b3e', ?1, 101, 0, ?1 + 101, 'PENDING', 0, ?2, 'Record separate appointment periods')`)
      .bind(revision, f.creator.accountId),
    ...periods.map((period) =>
      f.database
        .prepare(`INSERT INTO company_organization_responsibility_period_versions
      (period_id, revision, employee_id, employment_id, organization_unit_id, responsibility_type, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
      VALUES (?1, 1, ?2, ?3, '0190005f-0000-7000-8000-3e026079e0b5', 'MANAGER', ?4, ?5, 0, '842191ae-a0cd-4b53-a8a0-570d75957b3e', 0)`)
        .bind(
          period.id,
          f.creator.employeeId,
          f.assignment.attributes.employmentId,
          period.startsOn,
          period.endsOn,
        ),
    ),
    f.database.prepare(
      "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = '842191ae-a0cd-4b53-a8a0-570d75957b3e'",
    ),
  ])
  const preview = await f.preview()
  const input = {
    ...f.body,
    expectedRevision: preview.expectedRevision,
    snapshotDigest: preview.snapshotDigest,
    observedOn: preview.observedOn,
    mappings: [
      ...f.body.mappings,
      ...periods.map((period) => ({
        periodId: period.id,
        responsibilityId: "responsibility:manager",
        authorityScopeId: "scope:team",
      })),
    ],
  }
  const before = await f.state()
  await execSql(
    f.database,
    `CREATE TRIGGER reject_responsibility_second_command BEFORE INSERT ON company_resource_revisions
    WHEN NEW.command_id = 'responsibility-adoption:${preview.snapshotDigest}:1'
    BEGIN SELECT RAISE(ABORT, 'injected second command failure'); END;`,
  )
  expect(Number((await f.adopt("responsibility:bulk", input)).status)).toBe(503)
  expect(await f.state()).toEqual(before)
  await execSql(f.database, "DROP TRIGGER reject_responsibility_second_command")
  const response = await f.adopt("responsibility:bulk", input)
  expect(Number(response.status)).toBe(201)
  expect(await response.json()).toMatchObject({
    adoptedPeriods: 105,
    organizationRevision: preview.expectedRevision + 2,
  })
  const saved = await f.state()
  expect(saved.sources).toHaveLength(105)
  expect(Number((await f.adopt("responsibility:bulk", input)).status)).toBe(200)
  expect(await f.state()).toEqual(saved)
}, 60000)
