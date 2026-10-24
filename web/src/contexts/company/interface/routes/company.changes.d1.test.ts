import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { GET } from "@/contexts/company/interface/routes/company.changes"
import { GET as peopleGET } from "@/contexts/company/interface/routes/company.people"
import { GET as employeesGET } from "@/contexts/company/interface/routes/company.employees"
import { GET as employmentsGET } from "@/contexts/company/interface/routes/company.employments"
import { GET as organizationSnapshotsGET } from "@/contexts/company/interface/routes/company.organization-snapshots"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyChangeFeedRepository } from "@/contexts/company/infrastructure/repositories/core/company-change-feed.repository"
import { createCompanyPlaceTestContext } from "@/contexts/company/test/company-place.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const pageSchema = z.object({
  data: z.array(
    z.object({ resource_id: z.string(), organization_revision: z.number(), state: z.string() }),
  ),
  next_cursor: z.string(),
  has_more: z.boolean(),
  through_revision: z.number(),
})

async function fixture() {
  const database = await createLocalD1Database({
    schema: `
    CREATE TABLE company_organizations(id TEXT PRIMARY KEY, revision INTEGER);
    INSERT INTO company_organizations VALUES ('company:a', 3), ('company:b', 1);
    CREATE TABLE company_resource_revisions(
      organization_id TEXT, organization_revision INTEGER, resource_type TEXT, resource_id TEXT,
      revision INTEGER, command_id TEXT, state TEXT, effective_from TEXT, effective_to TEXT, recorded_at INTEGER);
    INSERT INTO company_resource_revisions VALUES
      ('company:a', 2, 'grade', 'z', 1, 'command:two', 'active', '2040-01-01', NULL, 20),
      ('company:a', 1, 'legal-entity', 'legal:a', 1, 'command:one', 'active', '2020-01-01', NULL, 10),
      ('company:a', 2, 'grade', 'a', 1, 'command:two', 'active', '2040-01-01', NULL, 20),
      ('company:a', 2, 'position', 'p', 1, 'command:two', 'active', '2040-01-01', NULL, 20),
      ('company:a', 3, 'grade', 'a', 2, 'command:three', 'void', '2040-01-01', NULL, 30),
      ('company:b', 1, 'person', 'private:person', 1, 'command:private', 'active', '2020-01-01', NULL, 10);
    ALTER TABLE company_resource_revisions ADD COLUMN actor_account_id TEXT NOT NULL DEFAULT '86adb280-2461-48cf-a05d-f13348222317';
    ALTER TABLE company_resource_revisions ADD COLUMN reason TEXT NOT NULL DEFAULT 'Confirmed company fact';
    ALTER TABLE company_resource_revisions ADD COLUMN evidence_references_json TEXT NOT NULL DEFAULT '[]';
    ALTER TABLE company_resource_revisions ADD COLUMN corrects_revision INTEGER;
    UPDATE company_resource_revisions SET evidence_references_json =
      '[{"context":"system","kind":"document","id":"source:hire","version":"1"}]'
      WHERE command_id = 'command:one';
  `,
  })
  const actors: { value: CompanyActorValue | null } = {
    value: CompanyActorValue.restore({
      accountId: "1227c813-1159-4405-9f5b-5e54df944b9a",
      employeeId: null,
      organizationIds: ["company:a"],
      capabilities: ["company:read"],
      permissions: ["employee:read", "employee:attributes:read"],
    }),
  }
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      if (actors.value !== null) context.set("companyActor", actors.value)
      await next()
    })
    .onError((error, context) =>
      context.json({ message: error.message }, error instanceof HTTPException ? error.status : 500),
    )
    .get("/changes", ...GET)
  const request = (query: Record<string, string> = {}, organizationId = "company:a") =>
    app.request(
      `/changes?${new URLSearchParams(query).toString()}`,
      { headers: { "x-company-organization-id": organizationId } },
      { DB: database },
    )
  return { database, actors, request }
}

test("組織閲覧だけでは人事変更を返さず、指定した組織資源だけを追跡できる", async () => {
  const f = await fixture()
  await execSql(
    f.database,
    `
    INSERT INTO company_resource_revisions
      (organization_id, organization_revision, resource_type, resource_id, revision,
       command_id, state, effective_from, effective_to, recorded_at)
    VALUES ('company:a', 3, 'person', 'person:private', 1,
            'command:person', 'active', '2020-01-01', NULL, 30)
  `,
  )
  f.actors.value = CompanyActorValue.restore({
    accountId: "eae1f52f-b3b9-42de-8a3d-9a3ee17c02fc",
    employeeId: null,
    organizationIds: ["company:a"],
    capabilities: ["company:read"],
    permissions: ["org:read"],
  })

  const all = await f.request({ limit: "100" })
  expect(all.status).toBe(200)
  const data = z
    .object({ data: z.array(z.object({ resource_type: z.string() })) })
    .parse(await all.json()).data
  expect(data.some((item) => item.resource_type === "person")).toBe(false)
  expect(data.some((item) => item.resource_type === "grade")).toBe(true)
  expect((await f.request({ resource_type: "person" })).status).toBe(403)
  const grades = await f.request({ resource_type: "grade" })
  expect(grades.status).toBe(200)
  expect(
    z
      .object({ data: z.array(z.object({ resource_type: z.string() })) })
      .parse(await grades.json())
      .data.every((item) => item.resource_type === "grade"),
  ).toBe(true)
})

test("変更取得は保存済みの変更者と理由を同じ会社版に返す", async () => {
  const f = await fixture()
  const page = z
    .object({
      data: z.array(
        z.object({
          organization_revision: z.number(),
          resource_id: z.string(),
          actor_account_id: z.string(),
          reason: z.string(),
          evidence_references: z.array(z.object({ id: z.string() })),
        }),
      ),
    })
    .parse(await (await f.request()).json())
  expect(page.data[0]).toEqual({
    organization_revision: 1,
    resource_id: "legal:a",
    actor_account_id: "86adb280-2461-48cf-a05d-f13348222317",
    reason: "Confirmed company fact",
    evidence_references: [{ id: "source:hire" }],
  })
})

test("原資料参照は正式revisionに残り、変更取得と再送判定に反映される", async () => {
  const f = await createCompanyPlaceTestContext()
  const repository = new D1CompanyResourceRepository({ database: f.database })
  const props = {
    commandId: "evidence:initial",
    actorAccountId: "86adb280-2461-48cf-a05d-f13348222317",
    reason: "Verified from signed source",
    recordedAt: 10,
    expectedRevision: 0,
    evidenceReferences: [
      { context: "system", kind: "document", id: "hire:original", version: "1" },
    ],
    resources: f.resources,
  }
  const command = CompanyResourceChangeEntity.create(props)
  if (command instanceof Error) throw command
  expect(await repository.write(command)).toMatchObject({ kind: "applied" })
  expect(await repository.write(command)).toMatchObject({ kind: "applied", replayed: true })
  const changedEvidence = CompanyResourceChangeEntity.create({
    ...props,
    evidenceReferences: [{ ...props.evidenceReferences[0]!, version: "2" }],
  })
  if (changedEvidence instanceof Error) throw changedEvidence
  expect(await repository.write(changedEvidence)).toMatchObject({ kind: "command_conflict" })
  const correction = CompanyResourceChangeEntity.create({
    ...props,
    commandId: "evidence:correction",
    expectedRevision: 1,
    corrections: [{ type: "legal-entity", id: f.legalEntity.id, revision: 2, correctsRevision: 1 }],
    resources: [{ ...f.legalEntity, revision: 2 }],
  })
  if (correction instanceof Error) throw correction
  expect(await repository.write(correction)).toMatchObject({ kind: "applied", replayed: false })
  expect(await repository.write(correction)).toMatchObject({ kind: "applied", replayed: true })
  const page = await new CompanyChangeFeedRepository(f.database).list({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    afterRevision: 0,
    afterType: null,
    afterId: null,
    afterResourceRevision: null,
    throughRevision: null,
    limit: 25,
  })
  if (page instanceof Error) throw page
  expect(page.changes).toHaveLength(f.resources.length + 1)
  expect(page.changes[0]?.evidence_references).toEqual(props.evidenceReferences)
  expect(page.changes.find((change) => change.revision === 2)).toMatchObject({
    resource_type: "legal-entity",
    corrects_revision: 1,
    evidence_references: props.evidenceReferences,
  })
})

test("同じcommandの変更をページ境界で失わず、停止・再送・独立consumerの再構築が一致する", async () => {
  const f = await fixture()
  const first = pageSchema.parse(await (await f.request({ limit: "2" })).json())
  expect(first.data.map((row) => row.resource_id)).toEqual(["legal:a", "a"])
  expect(first.has_more).toBe(true)
  const query = {
    cursor: first.next_cursor,
    through_revision: String(first.through_revision),
    limit: "2",
  }
  const second = pageSchema.parse(await (await f.request(query)).json())
  expect(second.data.map((row) => row.resource_id)).toEqual(["z", "p"])
  expect(pageSchema.parse(await (await f.request(query)).json())).toEqual(second)
  const third = pageSchema.parse(
    await (await f.request({ ...query, cursor: second.next_cursor })).json(),
  )
  expect(third.data).toEqual([{ resource_id: "a", organization_revision: 3, state: "void" }])
  expect(third.has_more).toBe(false)
  const complete = pageSchema.parse(await (await f.request()).json())
  expect([...first.data, ...second.data, ...third.data]).toEqual(complete.data)
  expect(
    pageSchema.parse(await (await f.request({ cursor: third.next_cursor })).json()).data,
  ).toEqual([])
})

test("取得中に追加された変更は固定した上限を越えず、完了cursorから次の会社版を取得する", async () => {
  const f = await fixture()
  const first = pageSchema.parse(await (await f.request({ limit: "2" })).json())
  await execSql(
    f.database,
    `UPDATE company_organizations SET revision = 4 WHERE id = 'company:a';
    INSERT INTO company_resource_revisions
      (organization_id, organization_revision, resource_type, resource_id, revision,
       command_id, state, effective_from, effective_to, recorded_at)
      VALUES ('company:a', 4, 'responsibility', 'later', 1, 'command:later', 'active', '2010-01-01', NULL, 40);`,
  )
  const pinned = pageSchema.parse(
    await (await f.request({ cursor: first.next_cursor, through_revision: "3" })).json(),
  )
  expect(pinned.data.map((row) => row.resource_id)).toEqual(["z", "p", "a"])
  expect(pinned.through_revision).toBe(3)
  const resumed = pageSchema.parse(await (await f.request({ cursor: pinned.next_cursor })).json())
  expect(resumed.data.map((row) => row.resource_id)).toEqual(["later"])
  expect(resumed.through_revision).toBe(4)
})

test("会社範囲・閲覧資格・認証を検査し、別会社のcursorと未来の会社版を拒否する", async () => {
  const f = await fixture()
  const first = pageSchema.parse(await (await f.request()).json())
  expect((await f.request({}, "company:b")).status).toBe(403)
  expect((await f.request({ through_revision: "4" })).status).toBe(400)
  expect((await f.request({ cursor: first.next_cursor, through_revision: "2" })).status).toBe(400)
  expect((await f.request({ cursor: "broken" })).status).toBe(400)
  expect(
    (
      await f.request({
        cursor: JSON.stringify({ organizationId: "company:b", revision: 0, type: null, id: null }),
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await f.request({
        cursor: JSON.stringify({
          organizationId: "company:a",
          revision: 2,
          type: "grade",
          id: null,
        }),
      })
    ).status,
  ).toBe(400)
  f.actors.value = CompanyActorValue.restore({
    accountId: "4616e8d3-5ed5-49be-95ca-45d279521d6b",
    employeeId: null,
    organizationIds: ["company:a"],
    capabilities: [],
    permissions: ["master:grade:write"],
  })
  expect((await f.request()).status).toBe(403)
  f.actors.value = null
  expect((await f.request()).status).toBe(401)
})

test("保存データや取得の異常を空の完了ページとして返さない", async () => {
  const f = await fixture()
  await execSql(
    f.database,
    "UPDATE company_resource_revisions SET resource_type = 'unknown' WHERE organization_id = 'company:a'",
  )
  expect((await f.request()).status).toBe(503)
  await execSql(f.database, "DROP TABLE company_resource_revisions")
  expect((await f.request()).status).toBe(503)
})

test("一つの会社版にある同一資源の複数改訂もページ境界で取りこぼさない", async () => {
  const f = await fixture()
  await execSql(
    f.database,
    `INSERT INTO company_resource_revisions
      (organization_id, organization_revision, resource_type, resource_id, revision,
       command_id, state, effective_from, effective_to, recorded_at)
      VALUES ('company:a', 2, 'grade', 'a', 2, 'command:two', 'void', '2040-01-01', NULL, 20)`,
  )
  const first = pageSchema.parse(await (await f.request({ limit: "2" })).json())
  const second = pageSchema.parse(
    await (await f.request({ cursor: first.next_cursor, limit: "1" })).json(),
  )
  expect(second.data).toEqual([{ resource_id: "a", organization_revision: 2, state: "void" }])
  const third = pageSchema.parse(
    await (await f.request({ cursor: second.next_cursor, limit: "1" })).json(),
  )
  expect(third.data.map((row) => row.resource_id)).toEqual(["z"])
})

test("実際の人事発令と公開履歴の全改訂を再構築し、旧台帳の内部参照を要求しない", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode()
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "feed:retired",
  )
  if (retired instanceof Error) throw retired
  const actor = CompanyActorValue.restore({
    ...f.creator,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:read"],
    permissions: ["employee:read", "employee:attributes:read"],
  })
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      context.set("companyActor", actor)
      await next()
    })
    .get("/changes", ...GET)
  const received: string[] = []
  const query = new URLSearchParams({ limit: "2" })
  for (const iteration of Array.from({ length: 100 }, (_, index) => index)) {
    const response = await app.request(
      `/changes?${query.toString()}`,
      { headers: { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID } },
      f.context.env,
    )
    expect(response.status).toBe(200)
    const page = z
      .object({
        data: z.array(
          z.object({
            organization_revision: z.number(),
            resource_type: z.string(),
            resource_id: z.string(),
            revision: z.number(),
            actor_account_id: z.string().min(1),
            reason: z.string().min(1),
          }),
        ),
        has_more: z.boolean(),
        next_cursor: z.string(),
        through_revision: z.number(),
      })
      .parse(await response.json())
    received.push(
      ...page.data.map((row) =>
        JSON.stringify([
          row.organization_revision,
          row.resource_type,
          row.resource_id,
          row.revision,
        ]),
      ),
    )
    if (!page.has_more) break
    if (iteration === 99) throw new Error("change feed failed to finish")
    query.set("cursor", page.next_cursor)
    query.set("through_revision", String(page.through_revision))
  }
  const expected = await f.database
    .prepare(
      `SELECT organization_revision, resource_type, resource_id, revision FROM company_resource_revisions WHERE organization_id = '${COMPANY_DEFAULT_ORGANIZATION_ID}' ORDER BY organization_revision, resource_type, resource_id, revision`,
    )
    .all<{
      organization_revision: number
      resource_type: string
      resource_id: string
      revision: number
    }>()
  expect(received).toEqual(
    expected.results.map((row) =>
      JSON.stringify([row.organization_revision, row.resource_type, row.resource_id, row.revision]),
    ),
  )
  expect(received.length).toBeGreaterThan(2)
  expect(new Set(received).size).toBe(received.length)
})

test("独立consumerは変更feedで発見したIDだけから同じ会社版の人物・雇用・所属を再構築できる", async () => {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.initializeAssignment()
  const pinnedRevision = await f.companyRevision()
  const actor = CompanyActorValue.restore({
    ...f.creator,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:read"],
    permissions: ["employee:read", "employee:attributes:read"],
  })
  const app = new Hono<CompanyHttpEnvironment>()
    .use("*", async (context, next) => {
      context.set("companyActor", actor)
      await next()
    })
    .get("/changes", ...GET)
    .get("/people", ...peopleGET)
    .get("/employees", ...employeesGET)
    .get("/employments", ...employmentsGET)
    .get("/organization-snapshots", ...organizationSnapshotsGET)
  const headers = { "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID }
  const env = f.context.env
  const fetchPage = async (query: URLSearchParams) => {
    const response = await app.request(`/changes?${query.toString()}`, { headers }, env)
    expect(response.status).toBe(200)
    return z
      .object({
        data: z.array(
          z.object({
            organization_revision: z.number(),
            resource_type: z.string(),
            resource_id: z.string(),
            revision: z.number(),
          }),
        ),
        has_more: z.boolean(),
        next_cursor: z.string(),
        through_revision: z.number(),
      })
      .parse(await response.json())
  }
  const query = new URLSearchParams({ limit: "2", through_revision: String(pinnedRevision) })
  const discovered = new Map<string, Set<string>>()
  let lastRevision = 0
  let previousPageLastRevision: number | null = null
  let splitRevisionAcrossPages = false
  let completionCursor: string | null = null
  for (let pageNumber = 0; pageNumber < 100; pageNumber++) {
    const page = await fetchPage(query)
    expect(page.through_revision).toBe(pinnedRevision)
    if (page.data[0]?.organization_revision === previousPageLastRevision) {
      splitRevisionAcrossPages = true
    }
    if (pageNumber === 0) {
      expect(await fetchPage(query)).toEqual(page)
      const retired = await f.personnel(
        {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        "feed:retired-during-reconstruction",
      )
      if (retired instanceof Error) throw retired
      expect(await f.companyRevision()).toBeGreaterThan(pinnedRevision)
    }
    for (const change of page.data) {
      expect(change.organization_revision).toBeGreaterThanOrEqual(lastRevision)
      lastRevision = change.organization_revision
      const ids = discovered.get(change.resource_type) ?? new Set<string>()
      ids.add(change.resource_id)
      discovered.set(change.resource_type, ids)
    }
    previousPageLastRevision = page.data.at(-1)?.organization_revision ?? null
    if (!page.has_more) {
      completionCursor = page.next_cursor
      break
    }
    if (pageNumber === 99) throw new Error("change feed did not finish")
    query.set("cursor", page.next_cursor)
  }
  expect(splitRevisionAcrossPages).toBe(true)

  const routes = [
    ["person", "/people"],
    ["employee", "/employees"],
    ["employment", "/employments"],
  ] as const
  const read = async (path: string, ids?: ReadonlySet<string>) => {
    const query = new URLSearchParams({
      organization_revision: String(pinnedRevision),
      effective_on: "2030-02-01",
    })
    for (const id of ids ?? []) query.append("id", id)
    const response = await app.request(`${path}?${query.toString()}`, { headers }, env)
    expect(response.status).toBe(200)
    return z
      .object({ organizationRevision: z.number(), resources: z.array(z.unknown()) })
      .parse(await response.json())
  }
  for (const [type, path] of routes) {
    const ids = discovered.get(type)
    expect(ids?.size).toBeGreaterThan(0)
    const whole = await read(path)
    expect(whole.organizationRevision).toBe(pinnedRevision)
    expect(whole.resources.length).toBeGreaterThan(0)
    const reconstructed = await read(path, ids)
    expect(reconstructed).toEqual(whole)
  }
  expect(discovered.get("organization-unit")?.size).toBeGreaterThan(0)
  expect(discovered.get("assignment")?.size).toBeGreaterThan(0)
  const organizationIds = new Set(
    [...discovered.entries()]
      .filter(([type]) =>
        [
          "organization-unit",
          "assignment",
          "reporting-relation",
          "office-assignment",
          "grade-assignment",
          "responsibility-assignment",
          "collective-body-membership",
          "organizational-authority",
        ].includes(type),
      )
      .flatMap(([, ids]) => [...ids]),
  )
  expect(organizationIds.size).toBeGreaterThan(0)
  expect(await read("/organization-snapshots", organizationIds)).toEqual(
    await read("/organization-snapshots"),
  )
  expect(completionCursor).not.toBeNull()
  const resumed = await fetchPage(new URLSearchParams({ cursor: completionCursor! }))
  expect(resumed.data.length).toBeGreaterThan(0)
  expect(resumed.data.every((change) => change.organization_revision > pinnedRevision)).toBe(true)
})
