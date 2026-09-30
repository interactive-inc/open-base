import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { readFileSync } from "node:fs"
import { Hono } from "hono"
import { z } from "zod"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyHTTPException } from "@/contexts/company/interface/errors"
import { POST } from "@/contexts/company/interface/routes/company.organization-changes"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import {
  D1CompanyResourceRepository,
  type CompanyResourceWriteResult,
} from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { createEmployeeAdoptionFixture } from "@/contexts/company/test/employee-resource-adoption.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

/** 組織の変更要求の ID。 */
const ORGANIZATION_REQUEST_ID = "a5c0e2d4-7b1f-4c3e-9a8d-2f6b1e0c9d7a"

const schema =
  readFileSync(
    new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8")
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
    kind: z.enum(["COMPANY", "DEPARTMENT"]),
    parentOrganizationUnitId: z.string().nullable(),
  }),
})
type Resource = z.infer<typeof resourceSchema>
const root: Resource = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  type: "organization-unit",
  id: "0190005f-0000-7000-8000-0e0100000001",
  revision: 1,
  state: "active",
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  attributes: {
    organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
    code: "ROOT",
    officialName: "Company",
    kind: "COMPANY",
    parentOrganizationUnitId: null,
  },
}
const child: Resource = {
  ...root,
  id: "0190005f-0000-7000-8000-0e0100000002",
  attributes: {
    organizationUnitId: "0190005f-0000-7000-8000-2924942897cc",
    code: "CHILD",
    officialName: "Department",
    kind: "DEPARTMENT",
    parentOrganizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
  },
}

async function fixture() {
  const database = await createLocalD1Database({ schema })
  const clock = { now: new Date("2026-09-07T00:00:00Z") }
  const actors = {
    current: CompanyActorValue.restore({
      accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      employeeId: null,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:write"],
    }),
  }
  const app = new Hono<CompanyHttpEnvironment>()
  app.use("*", async (context, next) => {
    context.set("companyActor", actors.current)
    context.set("companyClock", () => clock.now)
    await next()
  })
  app.onError((error, context) => {
    if (!(error instanceof CompanyHTTPException)) throw error
    if (error.etag !== null) context.header("etag", error.etag)
    return context.json({ code: error.code }, error.status)
  })
  app.post("/company/organization-changes", ...POST)
  const post = (
    resources: Resource[],
    revision: number,
    key: string,
    reason = "Confirmed organization change",
  ) =>
    app.request(
      "/company/organization-changes",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
          "if-match": `"${revision}"`,
          "idempotency-key": key,
        },
        body: JSON.stringify({ reason, resources }),
      },
      { DB: database },
    )
  const state = () =>
    database
      .prepare(
        `SELECT (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}') AS revision, (SELECT count(*) FROM company_command_receipts) AS receipts, (SELECT count(*) FROM company_resource_revisions) AS resources`,
      )
      .first()
  return { database, actors, post, state, clock }
}

describe("organization command receipts and boundaries", () => {
  test("親組織が後から取り消されても成功済みの子組織作成を再実行せず再送結果を返す", async () => {
    const f = await fixture()
    expect((await f.post([root], 0, "root-create")).status).toBe(201)
    expect((await f.post([child], 1, "child-create")).status).toBe(201)
    expect(
      (
        await f.post(
          [
            { ...child, revision: 2, state: "void" },
            { ...root, revision: 2, state: "void" },
          ],
          2,
          "organization-close",
        )
      ).status,
    ).toBe(201)
    const before = await f.state()
    const replay = await f.post([child], 1, "child-create")
    expect(replay.status).toBe(200)
    expect(
      z
        .object({ organizationRevision: z.number(), replayed: z.boolean() })
        .parse(await replay.json()),
    ).toEqual({ organizationRevision: 2, replayed: true })
    expect(await f.state()).toEqual(before)
    expect(
      await f.database
        .prepare("SELECT count(*) AS active FROM company_resource_heads WHERE state = 'active'")
        .first<number>("active"),
    ).toBe(0)
  })

  test("同じキーの別内容と、未成功の古い版の依頼を区別して拒否する", async () => {
    const f = await fixture()
    expect((await f.post([root], 0, "root-create")).status).toBe(201)
    const changed = await f.post([root], 0, "root-create", "Changed request")
    expect(changed.status).toBe(409)
    expect(await changed.json()).toMatchObject({ code: "company_command_conflict" })
    expect((await f.post([child], 0, "stale-new-command")).status).toBe(409)
    expect(await f.state()).toEqual({ revision: 1, receipts: 1, resources: 1 })
  })

  test("管理資格またはorganizationへのアクセスが失われた再送は拒否する", async () => {
    const f = await fixture()
    expect((await f.post([root], 0, "root-create")).status).toBe(201)
    f.actors.current = CompanyActorValue.restore({
      accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      employeeId: null,
      organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
      capabilities: ["company:write"],
    })
    expect((await f.post([root], 0, "root-create")).status).toBe(403)
    f.actors.current = CompanyActorValue.restore({
      accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      employeeId: null,
      organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
      capabilities: ["company:read"],
    })
    expect((await f.post([root], 0, "root-create")).status).toBe(403)
  })

  test("成功済みの再送では現在の組織snapshotを再検証しない", async () => {
    const f = await fixture()
    expect((await f.post([root], 0, "root-create")).status).toBe(201)
    const interception = spyOn(D1CompanyResourceRepository.prototype, "findMany").mockRejectedValue(
      new Error("snapshot unavailable"),
    )
    try {
      expect((await f.post([root], 0, "root-create")).status).toBe(200)
      expect(interception).not.toHaveBeenCalled()
    } finally {
      interception.mockRestore()
    }
  })

  test("同じ組織変更の同時再送は一回だけ確定する", async () => {
    const f = await fixture()
    const responses = await Promise.all([
      f.post([root], 0, "root-create"),
      f.post([root], 0, "root-create"),
    ])
    expect(
      responses.map((response) => response.status).toSorted((left, right) => left - right),
    ).toEqual([200, 201])
    expect(await f.state()).toEqual({ revision: 1, receipts: 1, resources: 1 })
  })

  test("初回receipt照会後に同じ依頼が確定しても保存済みの再送結果を返す", async () => {
    const f = await fixture()
    const repository = new D1CompanyResourceRepository({ database: f.database })
    const findMany = repository.findMany.bind(repository)
    const interception = spyOn(
      D1CompanyResourceRepository.prototype,
      "findMany",
    ).mockImplementationOnce(async (query) => {
      expect((await f.post([root], 0, "root-create")).status).toBe(201)
      return findMany(query)
    })
    try {
      expect((await f.post([root], 0, "root-create")).status).toBe(200)
    } finally {
      interception.mockRestore()
    }
    expect(await f.state()).toEqual({ revision: 1, receipts: 1, resources: 1 })
  })

  test("組織の保存失敗では履歴とreceiptを残さず、同じ依頼で再試行できる", async () => {
    const f = await fixture()
    await execSql(
      f.database,
      "CREATE TRIGGER reject_organization BEFORE INSERT ON company_resource_revisions BEGIN SELECT RAISE(ABORT, 'storage unavailable'); END;",
    )
    expect((await f.post([root], 0, "root-create")).status).toBe(503)
    expect(await f.state()).toEqual({ revision: null, receipts: 0, resources: 0 })
    await execSql(f.database, "DROP TRIGGER reject_organization")
    expect((await f.post([root], 0, "root-create")).status).toBe(201)
  })

  test("存在しない親と循環した親子関係を保存しない", async () => {
    const f = await fixture()
    expect((await f.post([child], 0, "missing-parent")).status).toBe(422)
    expect((await f.post([root, child], 0, "valid-tree")).status).toBe(201)
    const cycle = {
      ...root,
      revision: 2,
      attributes: {
        ...root.attributes,
        kind: child.attributes.kind,
        parentOrganizationUnitId: child.attributes.organizationUnitId,
      },
    }
    expect((await f.post([cycle], 1, "cycle")).status).toBe(422)
    expect(await f.state()).toEqual({ revision: 1, receipts: 1, resources: 2 })
  })
  test("組織snapshotの読取失敗では未成功の依頼を保存しない", async () => {
    const f = await fixture()
    const interception = spyOn(
      D1CompanyResourceRepository.prototype,
      "findMany",
    ).mockRejectedValueOnce(new Error("snapshot unavailable"))
    try {
      expect((await f.post([root], 0, "unavailable-read")).status).toBe(503)
    } finally {
      interception.mockRestore()
    }
    expect(await f.state()).toEqual({ revision: null, receipts: 0, resources: 0 })
  })

  test("検証後に組織が変更されても古い依頼を確定しない", async () => {
    const f = await fixture()
    expect((await f.post([root], 0, "root-create")).status).toBe(201)
    const repository = new D1CompanyResourceRepository({ database: f.database })
    const findMany = repository.findMany.bind(repository)
    const competing = CompanyResourceChangeEntity.create({
      commandId: "competing-root",
      expectedRevision: 1,
      actorAccountId: "d2c82c1d-214f-4a0e-8162-09c1f6704ea5",
      recordedAt: Date.now(),
      reason: "Confirmed rename",
      resources: [
        {
          ...root,
          revision: 2,
          effectiveFrom: restoreCalendarDate(root.effectiveFrom),
          effectiveTo: null,
          attributes: { ...root.attributes, officialName: "Renamed" },
        },
      ],
    })
    if (competing instanceof Error) throw competing
    const competingResults: CompanyResourceWriteResult[] = []
    const interception = spyOn(
      D1CompanyResourceRepository.prototype,
      "findMany",
    ).mockImplementationOnce(async (query) => {
      const snapshot = await findMany(query)
      competingResults.push(await repository.write(competing))
      return snapshot
    })
    try {
      const response = await f.post([child], 1, "racing-child")
      expect(competingResults).toMatchObject([{ kind: "applied" }])
      expect(response.status).toBe(409)
      expect(response.headers.get("etag")).toBe('"2"')
    } finally {
      interception.mockRestore()
    }
    expect(await f.state()).toEqual({ revision: 2, receipts: 2, resources: 2 })
    f.clock.now = new Date("2026-09-09T00:00:00Z")
    expect((await f.post([child], 2, "racing-child")).status).toBe(201)
    expect((await f.post([child], 2, "racing-child")).status).toBe(200)
    expect(await f.state()).toEqual({ revision: 3, receipts: 3, resources: 3 })
  })

  test("Companyの時計で履歴とreceiptを記録し、後日の再送で記録時刻を変えない", async () => {
    const f = await fixture()
    const recordedAt = f.clock.now.getTime()
    expect((await f.post([root], 0, "clocked-root")).status).toBe(201)
    const readTimes = () =>
      f.database
        .prepare(`SELECT
      (SELECT recorded_at FROM company_command_receipts WHERE command_id = 'clocked-root') AS receipt,
      (SELECT recorded_at FROM company_resource_revisions WHERE command_id = 'clocked-root') AS resource,
      (SELECT updated_at FROM company_resource_heads WHERE resource_id = '0190005f-0000-7000-8000-0e0100000001') AS head,
      (SELECT created_at FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}') AS created,
      (SELECT updated_at FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}') AS updated`)
        .first<{
          receipt: number
          resource: number
          head: number
          created: number
          updated: number
        }>()
    const expected = {
      receipt: recordedAt,
      resource: recordedAt,
      head: recordedAt,
      created: recordedAt,
      updated: recordedAt,
    }
    expect(await readTimes()).toEqual(expected)
    f.clock.now = new Date(recordedAt + 86400000)
    expect((await f.post([root], 0, "clocked-root")).status).toBe(200)
    expect(await readTimes()).toEqual(expected)
    expect(await f.state()).toEqual({ revision: 1, receipts: 1, resources: 1 })
  })

  test("不正なCompany時計では履歴を保存せず、時計の復旧後に同じ依頼で再試行できる", async () => {
    for (const invalid of [new Date(Number.NaN), new Date(-1)]) {
      const f = await fixture()
      const valid = f.clock.now
      f.clock.now = invalid
      const response = await f.post([root], 0, "invalid-clock")
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ code: "company_write_unavailable" })
      expect(await f.state()).toEqual({ revision: null, receipts: 0, resources: 0 })
      f.clock.now = valid
      expect((await f.post([root], 0, "invalid-clock")).status).toBe(201)
    }
  })
})

describe("legacy organization routes stay inside their Company scope", () => {
  test("別organizationの管理者は既定組織の参照・変更・成功済み依頼の再送ができない", async () => {
    const f = await createEmployeeAdoptionFixture()
    const adoption = await f.post(await f.input(), "organization-scope-employee-adoption")
    if (adoption.status !== 200) throw new Error("test employee adoption failed")
    const request = (path: string, method = "GET", body?: unknown) =>
      f.app.request(
        path,
        {
          method,
          headers: {
            "content-type": "application/json",
            "idempotency-key": ORGANIZATION_REQUEST_ID,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        },
        f.environment,
      )
    const body = { code: "SCOPE-UNIT", name: "Scoped Unit", parent_code: null }
    expect((await request("/company/organization-units", "POST", body)).status).toBe(201)
    const observed = z
      .object({ organization_revision: z.number(), as_of: z.string() })
      .parse(await (await request("/company/organization-units/SCOPE-UNIT")).json())
    const expectation = {
      expected_organization_revision: observed.organization_revision,
      expected_as_of: observed.as_of,
    }
    f.actors.current = CompanyActorValue.restore({
      accountId: f.actor.accountId,
      employeeId: f.actor.employeeId,
      capabilities: ["company:admin"],
      organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
    })
    for (const path of [
      "/company/organization-units",
      "/company/organization-tree",
      "/company/organization-units/SCOPE-UNIT",
      "/company/organization-units/SCOPE-UNIT/members",
      "/company/my-organization-units",
    ])
      expect((await request(path)).status).toBe(403)
    expect((await request("/company/organization-units", "POST", body)).status).toBe(403)
    expect(
      (
        await request("/company/organization-units/SCOPE-UNIT", "PUT", {
          name: "Changed",
          parent_code: null,
          ...expectation,
        })
      ).status,
    ).toBe(403)
    expect(
      (await request("/company/organization-units/SCOPE-UNIT", "DELETE", expectation)).status,
    ).toBe(403)
  })
})
