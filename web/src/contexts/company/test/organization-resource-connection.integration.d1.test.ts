import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { hc } from "hono/client"
import { z } from "zod"
import { createEmployeeAdoptionFixtureScope } from "@/contexts/company/test/employee-resource-adoption.test-support"
import {
  companyAuthenticatedRoutes,
  companyAuditedRoutes,
} from "@/contexts/company/interface/routes/company"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { OrganizationResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-resource-adoption-snapshot.adapter"
import { CompanyOrganizationResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-organization-resource-projection.adapter"
import { CompanyOrganizationResourceJournalAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-organization-resource-journal.adapter"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const resourceSchema = z.object({
  organizationId: z.string(),
  type: z.literal("organization-unit"),
  id: z.string(),
  revision: z.number(),
  state: z.enum(["active", "void"]),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  attributes: z.object({
    organizationUnitId: z.string(),
    code: z.string(),
    officialName: z.string(),
    kind: z.enum(["COMPANY", "DIVISION", "DEPARTMENT", "TEAM", "OTHER"]),
    parentOrganizationUnitId: z.string().nullable(),
  }),
})
type Resource = z.infer<typeof resourceSchema>
const previewSchema = z.object({
  expectedRevision: z.number(),
  snapshotDigest: z.string(),
  observedOn: z.string(),
  snapshot: z.object({
    periods: z.array(z.object({ periodId: z.string(), revision: z.number() })),
  }),
})
const snapshotSchema = z.object({
  organizationRevision: z.number(),
  resources: z.array(resourceSchema),
})

/** 既存の組織APIは冪等キーを操作IDに使うため、テストの名前付きキーを同じ UUID へ写す。 */
const operationKey = (key: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(key)
    ? key
    : deterministicCompanyId("test-operation", key)

async function createOrganizationFixture(
  createEmployeeAdoptionFixture: ReturnType<typeof createEmployeeAdoptionFixtureScope>,
) {
  const base = await createEmployeeAdoptionFixture()
  const employeeAdoption = await base.post(
    await base.input(),
    "organization-test-employee-adoption",
  )
  if (employeeAdoption.status !== 200)
    throw new Error(`employee adoption failed: ${employeeAdoption.status}`)
  const fetcher: typeof fetch = Object.assign(
    async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      base.app.request(input, init, { ...base.environment, NOW: base.clock.now.toISOString() }),
    { preconnect: fetch.preconnect },
  )
  const reads = hc<typeof companyAuthenticatedRoutes>("http://localhost/company", {
    fetch: fetcher,
  })
  const writes = hc<typeof companyAuditedRoutes>("http://localhost/company", { fetch: fetcher })
  const root = await base.database
    .prepare(
      "SELECT organization_unit_id AS id FROM company_organization_unit_period_versions WHERE kind = 'COMPANY' LIMIT 1",
    )
    .first<{ id: string }>()
  if (root === null) throw new Error("root missing")
  const preview = async (id: string) => {
    const response = await reads["organization-resource-adoptions"].$get({
      query: { organization_unit_id: id },
    })
    expect(Number(response.status)).toBe(200)
    const body = previewSchema.parse(await response.json())
    return {
      organizationUnitId: id,
      expectedRevision: body.expectedRevision,
      snapshotDigest: body.snapshotDigest,
      observedOn: body.observedOn,
      reason: "Confirmed organization history",
      ...(id === root.id
        ? {
            initializationConfirmation: {
              startsOn: "2020-01-01",
              evidenceReferences: [
                {
                  context: "company",
                  kind: "confirmed-test-history",
                  id: "root-start",
                  version: "1",
                },
              ],
            },
          }
        : {}),
    }
  }
  const adopt = (input: Awaited<ReturnType<typeof preview>>, key: string) =>
    writes["organization-resource-adoptions"].$post({
      header: { "idempotency-key": key },
      json: input,
    })
  const connect = async (id = root.id) => {
    const response = await adopt(await preview(id), `adopt:${id}`)
    expect(Number(response.status)).toBe(201)
    return response
  }
  const create = (code: string, key = `create:${code}`) =>
    writes["organization-units"].$post(
      { json: { code, name: code, parent_code: null } },
      { headers: { "idempotency-key": operationKey(key) } },
    )
  const observe = async (code: string) => {
    const response = await reads["organization-units"][":code"].$get({ param: { code } })
    expect(Number(response.status)).toBe(200)
    const body = z
      .object({ organization_revision: z.number(), as_of: z.string() })
      .parse(await response.json())
    return {
      expected_organization_revision: body.organization_revision,
      expected_as_of: body.as_of,
    }
  }
  const rename = async (code: string, name: string, key: string = crypto.randomUUID()) =>
    writes["organization-units"][":code"].$put(
      { param: { code }, json: { name, parent_code: null, ...(await observe(code)) } },
      { headers: { "idempotency-key": operationKey(key) } },
    )
  const snapshot = async (asOf = "2026-09-07") => {
    const response = await reads["organization-snapshots"].$get({
      header: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID },
      query: { as_of: asOf },
    })
    expect(Number(response.status)).toBe(200)
    return snapshotSchema.parse(await response.json())
  }
  const change = (resources: Resource[], revision: number, key: string) =>
    writes["organization-changes"].$post({
      header: {
        "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
        "if-match": String(revision),
        "idempotency-key": key,
      },
      json: { reason: "Confirmed organization change", resources },
    })
  const legacy = async () =>
    (
      await base.database
        .prepare(
          "SELECT * FROM company_organization_unit_period_versions ORDER BY period_id, revision",
        )
        .all()
    ).results
  const state = async () =>
    await base.database
      .prepare(`SELECT (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}') AS companyRevision,
    (SELECT revision FROM company_organization_lifecycle_states WHERE id = 1) AS lifecycleRevision,
    (SELECT count(*) FROM company_command_receipts) AS receipts, (SELECT count(*) FROM company_resource_revisions) AS resources,
    (SELECT count(*) FROM company_organization_change_operations) AS operations, (SELECT count(*) FROM company_organization_resource_bindings) AS bindings,
    (SELECT count(*) FROM company_organization_resource_adoptions) AS adoptions`)
      .first()
  return {
    ...base,
    reads,
    writes,
    root,
    preview,
    adopt,
    connect,
    create,
    rename,
    observe,
    snapshot,
    change,
    legacy,
    state,
  }
}

/** 組織単位の期間版から、記録した操作への外部キーだけを外して作り直す。 */
async function dropPeriodVersionOperationReference(database: D1Database): Promise<void> {
  const table = "company_organization_unit_period_versions"
  const definition = await database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?1")
    .bind(table)
    .first<{ sql: string }>()
  if (definition === null) throw new Error(`${table} is missing`)
  const withoutReference = definition.sql.replace(
    /(recorded_by_action_id\s+TEXT[^,]*?)\s+REFERENCES\s+"?[A-Za-z0-9_]+"?\s*\(\s*id\s*\)(?:\s+ON\s+DELETE\s+RESTRICT)?/iu,
    "$1",
  )
  if (withoutReference === definition.sql)
    throw new Error(`${table} has no operation reference to remove`)
  const unconstrained = withoutReference.replace(
    /^CREATE TABLE\s+("?)[A-Za-z0-9_]+\1/u,
    `CREATE TABLE "__unconstrained_${table}"`,
  )
  const indexes = (
    await database
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ?1 AND sql IS NOT NULL",
      )
      .bind(table)
      .all<{ sql: string }>()
  ).results
  // 作り直しの途中で表を参照するviewとtriggerが壊れないよう、全て外してから戻す。
  const dependents = (
    await database
      .prepare(
        "SELECT type, name, sql FROM sqlite_master WHERE type IN ('view', 'trigger') AND sql IS NOT NULL ORDER BY type DESC, rowid",
      )
      .all<{ type: "view" | "trigger"; name: string; sql: string }>()
  ).results
  await database.batch([
    database.prepare("PRAGMA defer_foreign_keys = ON"),
    ...dependents.map((dependent) =>
      database.prepare(
        `DROP ${dependent.type.toUpperCase()} "${dependent.name.replaceAll('"', '""')}"`,
      ),
    ),
    database.prepare(unconstrained),
    database.prepare(`INSERT INTO "__unconstrained_${table}" SELECT * FROM "${table}"`),
    database.prepare(`DROP TABLE "${table}"`),
    database.prepare(`ALTER TABLE "__unconstrained_${table}" RENAME TO "${table}"`),
    ...indexes.map((index) => database.prepare(index.sql)),
    ...[...dependents].reverse().map((dependent) => database.prepare(dependent.sql)),
  ])
}

describe("organization resources and the company period ledger", () => {
  const createEmployeeAdoptionFixture = createEmployeeAdoptionFixtureScope()
  const fixture = () => createOrganizationFixture(createEmployeeAdoptionFixture)

  test("初期履歴の確認を省略すると書き込まず、証跡保存の失敗でも訂正全体を戻す", async () => {
    const f = await fixture()
    const input = await f.preview(f.root.id)
    const before = await f.state()
    const original = await f.legacy()
    expect(
      Number(
        (await f.adopt({ ...input, initializationConfirmation: undefined }, "unconfirmed-root"))
          .status,
      ),
    ).toBe(422)
    expect(await f.state()).toEqual(before)
    await execSql(
      f.database,
      "CREATE TRIGGER fail_root_adoption BEFORE INSERT ON company_organization_resource_adoptions BEGIN SELECT RAISE(ABORT, 'injected failure'); END;",
    )
    expect(Number((await f.adopt(input, "confirmed-root")).status)).toBe(503)
    expect(await f.state()).toEqual(before)
    expect(await f.legacy()).toEqual(original)
    await execSql(f.database, "DROP TRIGGER fail_root_adoption")
    expect(Number((await f.adopt(input, "confirmed-root")).status)).toBe(201)
  })

  test("初期の仮期間を保全し、確認した日より前には組織が存在したと推定しない", async () => {
    const f = await fixture()
    const original = await f.legacy()
    const input = await f.preview(f.root.id)
    expect(Number((await f.adopt(input, "confirmed-root")).status)).toBe(201)
    expect((await f.snapshot("2019-12-31")).resources).toHaveLength(0)
    expect((await f.snapshot("2020-01-01")).resources).toEqual([
      expect.objectContaining({ revision: 2, state: "active", effectiveFrom: "2020-01-01" }),
    ])
    const periods = await f.database
      .prepare(
        "SELECT revision,starts_on FROM company_organization_unit_period_versions WHERE organization_unit_id=?1 ORDER BY revision",
      )
      .bind(f.root.id)
      .all()
    expect(periods.results).toEqual([
      { revision: 1, starts_on: "1970-01-01" },
      { revision: 2, starts_on: "2020-01-01" },
    ])
    expect(await f.legacy()).toEqual(expect.arrayContaining(original))
    const state = await f.state()
    expect(Number((await f.adopt(input, "confirmed-root")).status)).toBe(200)
    expect(await f.state()).toEqual(state)
    expect(
      Number(
        (
          await f.adopt(
            {
              ...input,
              initializationConfirmation: {
                ...input.initializationConfirmation!,
                startsOn: "2021-01-01",
              },
            },
            "confirmed-root",
          )
        ).status,
      ),
    ).toBe(409)
  })

  test("既存の全訂正履歴と元の台帳を保全し、公開履歴へ一回だけ接続する", async () => {
    const f = await fixture()
    const created = await f.create("HISTORY")
    expect(Number(created.status)).toBe(201)
    const unit = z.object({ id: z.string() }).parse(await created.json())
    expect(Number((await f.rename("HISTORY", "Corrected Name")).status)).toBe(200)
    await f.connect()
    const before = await f.legacy()
    const input = await f.preview(unit.id)
    expect(Number((await f.adopt(input, "history-adoption")).status)).toBe(201)
    expect(await f.legacy()).toEqual(before)
    expect(
      (await f.snapshot()).resources.find((resource) => resource.attributes.code === "HISTORY"),
    ).toMatchObject({ revision: 2, attributes: { officialName: "Corrected Name" } })
    const receipt = await f.database
      .prepare(
        "SELECT source_json FROM company_organization_resource_adoptions WHERE command_id = 'history-adoption'",
      )
      .first<{ source_json: string }>()
    if (receipt === null) throw new Error("receipt missing")
    expect(
      z
        .object({
          periods: z.array(z.object({ revision: z.number(), actorAccountId: z.string() })),
        })
        .parse(JSON.parse(receipt.source_json))
        .periods.map((period) => period.revision),
    ).toEqual([1, 2])
    const state = await f.state()
    f.clock.now = new Date("2026-09-08T00:00:00Z")
    expect(Number((await f.adopt(input, "history-adoption")).status)).toBe(200)
    expect(await f.state()).toEqual(state)
    expect(
      Number((await f.adopt({ ...input, reason: "Different request" }, "history-adoption")).status),
    ).toBe(409)
  })

  test("既存の新設・更新と公開APIの更新が同じ組織を変更し、再送で履歴を増やさない", async () => {
    const f = await fixture()
    await f.connect()
    expect(Number((await f.create("SHARED")).status)).toBe(201)
    const current = await f.snapshot()
    const resource = current.resources.find((resource) => resource.attributes.code === "SHARED")
    if (resource === undefined) throw new Error("public organization missing")
    const changed = {
      ...resource,
      revision: resource.revision + 1,
      attributes: { ...resource.attributes, officialName: "Public Name" },
    }
    expect(
      Number((await f.change([changed], current.organizationRevision, "public-rename")).status),
    ).toBe(201)
    const legacy = await f.reads["organization-units"][":code"].$get({ param: { code: "SHARED" } })
    expect(Number(legacy.status)).toBe(200)
    expect(await legacy.json()).toMatchObject({ name: "Public Name" })
    expect(Number((await f.rename("SHARED", "Legacy Name")).status)).toBe(200)
    expect(
      (await f.snapshot()).resources.find((candidate) => candidate.id === resource.id),
    ).toMatchObject({ revision: 3, attributes: { officialName: "Legacy Name" } })
    const before = await f.state()
    expect(
      Number((await f.change([changed], current.organizationRevision, "public-rename")).status),
    ).toBe(200)
    expect(Number((await f.create("SHARED")).status)).toBe(200)
    expect(await f.state()).toEqual(before)
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM company_organization_resource_mismatches")
        .first<number>("count"),
    ).toBe(0)
  })

  test("接続台帳の照会失敗を未接続と扱わず、新設を全体拒否して再試行できる", async () => {
    const f = await fixture()
    await f.connect()
    const before = await f.state()
    const history = await f.legacy()
    const prepare = f.database.prepare.bind(f.database)
    const interception = spyOn(f.database, "prepare").mockImplementation((sql) => {
      const statement = prepare(sql)
      if (
        sql.startsWith("SELECT organization_unit_id FROM company_organization_resource_bindings")
      ) {
        const all = statement.all.bind(statement)
        spyOn(statement, "all").mockImplementation(async () =>
          Object.defineProperty({ ...(await all()), results: [] }, "success", { value: false }),
        )
      }
      return statement
    })
    try {
      expect(Number((await f.create("RETRY_BINDING_READ")).status)).toBe(503)
    } finally {
      interception.mockRestore()
    }
    expect(await f.state()).toEqual(before)
    expect(await f.legacy()).toEqual(history)
    expect(Number((await f.create("RETRY_BINDING_READ")).status)).toBe(201)
    expect(
      (await f.snapshot()).resources.find(
        (resource) => resource.attributes.code === "RETRY_BINDING_READ",
      ),
    ).toMatchObject({ revision: 1 })
  })

  test("公開APIで新設した組織を既存一覧から参照できる", async () => {
    const f = await fixture()
    await f.connect()
    const current = await f.snapshot()
    const resource: Resource = {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "organization-unit",
      id: "0190005f-0000-7000-8000-0e0100000005",
      revision: 1,
      state: "active",
      effectiveFrom: "2026-09-07",
      effectiveTo: null,
      attributes: {
        organizationUnitId: "0190005f-0000-7000-8000-4051856b7055",
        code: "PUBLIC",
        officialName: "Public Department",
        kind: "DEPARTMENT",
        parentOrganizationUnitId: f.root.id,
      },
    }
    expect(
      Number((await f.change([resource], current.organizationRevision, "public-create")).status),
    ).toBe(201)
    expect(
      await (
        await f.reads["organization-units"][":code"].$get({ param: { code: "PUBLIC" } })
      ).json(),
    ).toMatchObject({ id: "0190005f-0000-7000-8000-4051856b7055", name: "Public Department" })
    expect(Number((await f.rename("PUBLIC", "Changed through existing API")).status)).toBe(200)
    expect(
      (await f.snapshot()).resources.find(
        (resource) => resource.id === "0190005f-0000-7000-8000-0e0100000005",
      ),
    ).toMatchObject({ revision: 2, attributes: { officialName: "Changed through existing API" } })
  })

  test("開始日を後ろへ訂正しても過去の版を復活させず、両方の時点参照を一致させる", async () => {
    const f = await fixture()
    await f.connect()
    expect(Number((await f.create("FUTURE")).status)).toBe(201)
    const current = await f.snapshot()
    const resource = current.resources.find((resource) => resource.attributes.code === "FUTURE")
    if (resource === undefined) throw new Error("public organization missing")
    expect(
      Number(
        (
          await f.change(
            [{ ...resource, revision: 2, effectiveFrom: "2026-09-10" }],
            current.organizationRevision,
            "correct-start",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      (await f.snapshot("2026-09-07")).resources.some(
        (resource) => resource.attributes.code === "FUTURE",
      ),
    ).toBe(false)
    expect(
      Number(
        (await f.reads["organization-units"][":code"].$get({ param: { code: "FUTURE" } })).status,
      ),
    ).toBe(404)
    f.clock.now = new Date("2026-09-10T00:00:00Z")
    expect(
      (await f.snapshot("2026-09-10")).resources.some(
        (resource) => resource.attributes.code === "FUTURE",
      ),
    ).toBe(true)
    expect(
      Number(
        (await f.reads["organization-units"][":code"].$get({ param: { code: "FUTURE" } })).status,
      ),
    ).toBe(200)
  })

  test("親の未接続、古い確認内容、権限と会社範囲の不一致を拒否する", async () => {
    const f = await fixture()
    const child = z.object({ id: z.string() }).parse(await (await f.create("UNBOUND")).json())
    expect(Number((await f.adopt(await f.preview(child.id), "child-before-root")).status)).toBe(422)
    const stale = await f.preview(f.root.id)
    expect(Number((await f.rename("UNBOUND", "Changed after preview")).status)).toBe(200)
    expect(Number((await f.adopt(stale, "stale-root")).status)).toBe(409)
    const valid = await f.preview(f.root.id)
    f.actors.current = CompanyActorValue.restore({
      accountId: f.actor.accountId,
      employeeId: f.actor.employeeId,
      organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
      capabilities: ["company:admin"],
    })
    expect(Number((await f.adopt(valid, "foreign-adoption")).status)).toBe(403)
    expect(
      Number(
        (
          await f.reads["organization-resource-adoptions"].$get({
            query: { organization_unit_id: f.root.id },
          })
        ).status,
      ),
    ).toBe(403)
    f.actors.current = CompanyActorValue.restore({
      accountId: f.actor.accountId,
      employeeId: f.actor.employeeId,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:write"],
    })
    expect(Number((await f.adopt(valid, "non-admin-adoption")).status)).toBe(403)
  })

  test.each(["operation", "revision"])("欠落した%sを含む既存履歴を接続しない", async (missing) => {
    const f = await fixture()
    await f.create("INCOMPLETE")
    await f.rename("INCOMPLETE", "Corrected")
    const unit = await f.database
      .prepare(
        "SELECT organization_unit_id AS id FROM company_organization_unit_period_versions WHERE code = 'INCOMPLETE' LIMIT 1",
      )
      .first<{ id: string }>()
    if (unit === null) throw new Error("organization fixture missing")
    await f.connect()
    const mutation = missing === "operation" ? "update" : "delete"
    const triggers = await f.database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'company_organization_unit_period_versions' AND name LIKE ?1",
      )
      .bind(`%unit_period_versions_immutable_${mutation}`)
      .all<{ name: string }>()
    expect(triggers.results).toHaveLength(1)
    for (const trigger of triggers.results) {
      await execSql(f.database, `DROP TRIGGER "${trigger.name.replaceAll('"', '""')}"`)
    }
    if (missing === "operation") {
      // ローカルD1は外部キーを止められない。外部キーの無かった時期の履歴を再現するため、
      // 操作への参照だけを外した定義で表を作り直してから、存在しない操作を指させる。
      await dropPeriodVersionOperationReference(f.database)
      await f.database
        .prepare(
          "UPDATE company_organization_unit_period_versions SET recorded_by_action_id = 'missing-operation' WHERE organization_unit_id = ?1 AND revision = 1",
        )
        .bind(unit.id)
        .run()
    } else {
      await f.database
        .prepare(
          "DELETE FROM company_organization_unit_period_versions WHERE organization_unit_id = ?1 AND revision = 1",
        )
        .bind(unit.id)
        .run()
    }
    const before = await f.state()
    const history = await f.legacy()
    if (missing === "operation") {
      const response = await f.reads["organization-resource-adoptions"].$get({
        query: { organization_unit_id: unit.id },
      })
      expect(Number(response.status)).toBe(503)
    } else {
      const response = await f.adopt(await f.preview(unit.id), "incomplete-history")
      expect(Number(response.status)).toBe(422)
    }
    expect(await f.state()).toEqual(before)
    expect(await f.legacy()).toEqual(history)
  })

  test("最後の移行証跡の保存失敗で全変更を取り消し、同じ依頼を再試行できる", async () => {
    const f = await fixture()
    const input = await f.preview(f.root.id)
    const before = await f.state()
    await execSql(
      f.database,
      "CREATE TRIGGER reject_adoption BEFORE INSERT ON company_organization_resource_adoptions BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END;",
    )
    expect(Number((await f.adopt(input, "retry-adoption")).status)).toBe(503)
    expect(await f.state()).toEqual(before)
    await execSql(f.database, "DROP TRIGGER reject_adoption")
    expect(Number((await f.adopt(input, "retry-adoption")).status)).toBe(201)
    for (const table of [
      "company_organization_resource_adoptions",
      "company_organization_resource_bindings",
    ]) {
      const deleted = await f.database
        .prepare(`DELETE FROM ${table}`)
        .run()
        .catch((cause: unknown) => cause)
      if (!(deleted instanceof Error)) throw new Error("immutable history was deleted")
      expect(deleted.message).toContain("immutable")
    }
  })

  test("同じ冪等キーの二重送信を一回の接続として確定する", async () => {
    const f = await fixture()
    const input = await f.preview(f.root.id)
    const responses = await Promise.all([
      f.adopt(input, "same-adoption"),
      f.adopt(input, "same-adoption"),
    ])
    expect(
      responses.map((response) => response.status).toSorted((left, right) => left - right),
    ).toEqual([200, 201])
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM company_organization_resource_adoptions")
        .first<number>("count"),
    ).toBe(1)
  })

  // 冪等キーが違う競合は別 test にする。fixture は 1 つで 8 秒前後かかるので、
  // 2 つ作ると CI の 15 秒制限に張り付いて反映のたびに落ちる。
  test("冪等キーが違う同時の移行依頼は後から来た方を拒否する", async () => {
    const other = await fixture()
    const otherInput = await other.preview(other.root.id)
    const conflicting = await Promise.all([
      other.adopt(otherInput, "first-adoption"),
      other.adopt(otherInput, "second-adoption"),
    ])
    expect(
      conflicting
        .map((response) => Number(response.status))
        .toSorted((left, right) => left - right),
    ).toEqual([201, 409])
  })

  test("確認後から保存直前までに台帳が変わった移行を拒否する", async () => {
    const f = await fixture()
    const input = await f.preview(f.root.id)
    const snapshotAdapter = new OrganizationResourceAdoptionSnapshotAdapter(f.database)
    const prepare = snapshotAdapter.prepareGuard.bind(snapshotAdapter)
    const interception = spyOn(
      OrganizationResourceAdoptionSnapshotAdapter.prototype,
      "prepareGuard",
    ).mockImplementationOnce(
      function (this: OrganizationResourceAdoptionSnapshotAdapter, snapshot) {
        const guard = prepare(snapshot)
        const original = f.database.batch.bind(f.database)
        spyOn(f.database, "batch").mockImplementationOnce(async (statements) => {
          await f.create("RACING")
          return original(statements)
        })
        return guard
      },
    )
    try {
      expect(Number((await f.adopt(input, "racing-adoption")).status)).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM company_organization_resource_bindings")
        .first<number>("count"),
    ).toBe(0)
  })

  test("旧台帳への片側writeをDBが拒否し、公開履歴と版を保全する", async () => {
    const f = await fixture()
    await f.connect()
    expect(Number((await f.create("GUARDED")).status)).toBe(201)
    const before = await f.state()
    const interception = spyOn(
      CompanyOrganizationResourceJournalAdapter.prototype,
      "prepare",
    ).mockResolvedValueOnce([])
    try {
      expect(Number((await f.rename("GUARDED", "Would diverge")).status)).toBe(422)
    } finally {
      interception.mockRestore()
    }
    expect(await f.state()).toEqual(before)
    expect(
      (await f.snapshot()).resources.find((resource) => resource.attributes.code === "GUARDED"),
    ).toMatchObject({ attributes: { officialName: "GUARDED" } })
  })
  test("将来の改組は新しい期間として保存し、既存APIの変更は当日の期間だけを訂正する", async () => {
    const f = await fixture()
    await f.connect()
    expect(Number((await f.create("PERIODS")).status)).toBe(201)
    const current = await f.snapshot()
    const resource = current.resources.find((resource) => resource.attributes.code === "PERIODS")
    if (resource === undefined) throw new Error("resource missing")
    const future = {
      ...resource,
      id: "0190005f-0000-7000-8000-0e010000000d",
      revision: 1,
      effectiveFrom: "2026-09-10",
      attributes: { ...resource.attributes, officialName: "Future Name" },
    }
    expect(
      Number(
        (
          await f.change(
            [future, { ...resource, revision: 2, effectiveTo: "2026-09-10" }],
            current.organizationRevision,
            "new-period",
          )
        ).status,
      ),
    ).toBe(201)
    expect(
      Number((await f.rename("PERIODS", "Current Name", "current-period-update")).status),
    ).toBe(200)
    expect(
      (await f.snapshot("2026-09-07")).resources.find((candidate) => candidate.id === resource.id),
    ).toMatchObject({ revision: 3, attributes: { officialName: "Current Name" } })
    expect(
      (await f.snapshot("2026-09-10")).resources.find((candidate) => candidate.id === future.id),
    ).toMatchObject({ revision: 1, attributes: { officialName: "Future Name" } })
    const beforeDateChange = await f.observe("PERIODS")
    f.clock.now = new Date("2026-09-10T00:00:00Z")
    expect(
      await (
        await f.reads["organization-units"][":code"].$get({ param: { code: "PERIODS" } })
      ).json(),
    ).toMatchObject({ name: "Future Name" })
    const beforeStaleEdit = await f.state()
    expect(
      Number(
        (
          await f.writes["organization-units"][":code"].$put(
            {
              param: { code: "PERIODS" },
              json: { name: "Old screen", parent_code: null, ...beforeDateChange },
            },
            { headers: { "idempotency-key": operationKey("stale-future-period") } },
          )
        ).status,
      ),
    ).toBe(409)
    expect(await f.state()).toEqual(beforeStaleEdit)
    expect(
      Number((await f.rename("PERIODS", "Future Corrected", "future-period-update")).status),
    ).toBe(200)
    expect(
      (await f.snapshot("2026-09-07")).resources.find((candidate) => candidate.id === resource.id),
    ).toMatchObject({ revision: 3, attributes: { officialName: "Current Name" } })
    expect(
      Number(
        (
          await f.writes["organization-units"][":code"].$delete(
            { param: { code: "PERIODS" }, json: await f.observe("PERIODS") },
            { headers: { "idempotency-key": operationKey("cancel-future-period") } },
          )
        ).status,
      ),
    ).toBe(204)
    expect(
      Number(
        (await f.reads["organization-units"][":code"].$get({ param: { code: "PERIODS" } })).status,
      ),
    ).toBe(404)
    expect(
      (await f.snapshot("2026-09-10")).resources.some(
        (candidate) => candidate.attributes.code === "PERIODS",
      ),
    ).toBe(false)
  })

  test("公開履歴への片側writeもDBが拒否する", async () => {
    const f = await fixture()
    await f.connect()
    expect(Number((await f.create("PUBLIC-GUARD")).status)).toBe(201)
    const current = await f.snapshot()
    const resource = current.resources.find(
      (resource) => resource.attributes.code === "PUBLIC-GUARD",
    )
    if (resource === undefined) throw new Error("resource missing")
    const before = await f.state()
    const interception = spyOn(
      CompanyOrganizationResourceProjectionAdapter.prototype,
      "prepare",
    ).mockResolvedValueOnce({ beforeWorkforce: [], statements: [] })
    try {
      expect(
        Number(
          (
            await f.change(
              [
                {
                  ...resource,
                  revision: 2,
                  attributes: { ...resource.attributes, officialName: "Would diverge" },
                },
              ],
              current.organizationRevision,
              "missing-projection",
            )
          ).status,
        ),
      ).toBe(422)
    } finally {
      interception.mockRestore()
    }
    expect(await f.state()).toEqual(before)
  })

  test("公開側と既存側の同時変更では一方だけが確定する", async () => {
    const f = await fixture()
    await f.connect()
    expect(Number((await f.create("CONCURRENT")).status)).toBe(201)
    const current = await f.snapshot()
    const resource = current.resources.find((resource) => resource.attributes.code === "CONCURRENT")
    if (resource === undefined) throw new Error("resource missing")
    const journalAdapter = new CompanyOrganizationResourceJournalAdapter(f.database)
    const original = journalAdapter.prepare.bind(journalAdapter)
    const interception = spyOn(
      CompanyOrganizationResourceJournalAdapter.prototype,
      "prepare",
    ).mockImplementationOnce(
      async function (this: CompanyOrganizationResourceJournalAdapter, change) {
        const statements = await original(change)
        expect(
          Number(
            (
              await f.change(
                [
                  {
                    ...resource,
                    revision: 2,
                    attributes: { ...resource.attributes, officialName: "Public winner" },
                  },
                ],
                current.organizationRevision,
                "public-winner",
              )
            ).status,
          ),
        ).toBe(201)
        return statements
      },
    )
    try {
      expect(
        Number((await f.rename("CONCURRENT", "Would overwrite winner", "legacy-loser")).status),
      ).toBe(409)
    } finally {
      interception.mockRestore()
    }
    expect(
      (await f.snapshot()).resources.find((candidate) => candidate.id === resource.id),
    ).toMatchObject({ revision: 2, attributes: { officialName: "Public winner" } })
    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM company_organization_resource_mismatches")
        .first<number>("count"),
    ).toBe(0)
  })

  test("公開側と既存側の保存失敗を全取消し、同じ依頼で再試行できる", async () => {
    const f = await fixture()
    await f.connect()
    expect(Number((await f.create("FAILURE")).status)).toBe(201)
    const current = await f.snapshot()
    const resource = current.resources.find((resource) => resource.attributes.code === "FAILURE")
    if (resource === undefined) throw new Error("resource missing")
    const changed = {
      ...resource,
      revision: 2,
      attributes: { ...resource.attributes, officialName: "Saved after retry" },
    }
    const before = await f.state()
    await execSql(
      f.database,
      "CREATE TRIGGER fail_period BEFORE INSERT ON company_organization_unit_period_versions BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END;",
    )
    expect(
      Number((await f.change([changed], current.organizationRevision, "public-retry")).status),
    ).toBe(503)
    expect(await f.state()).toEqual(before)
    await execSql(f.database, "DROP TRIGGER fail_period")
    expect(
      Number((await f.change([changed], current.organizationRevision, "public-retry")).status),
    ).toBe(201)
    const afterPublic = await f.state()
    await execSql(
      f.database,
      "CREATE TRIGGER fail_public BEFORE INSERT ON company_resource_revisions BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END;",
    )
    expect(Number((await f.rename("FAILURE", "Legacy retry", "legacy-retry")).status)).toBe(503)
    expect(await f.state()).toEqual(afterPublic)
    await execSql(f.database, "DROP TRIGGER fail_public")
    expect(Number((await f.rename("FAILURE", "Legacy retry", "legacy-retry")).status)).toBe(200)
  })
})
