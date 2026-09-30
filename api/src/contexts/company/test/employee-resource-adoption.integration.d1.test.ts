import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { z } from "zod"
import {
  createEmployeeAdoptionFixtureScope,
  adoptionEmployeeId,
} from "@/contexts/company/test/employee-resource-adoption.test-support"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { EmployeeResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee-resource-adoption/employee-resource-adoption-snapshot.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const counts = (database: D1Database) =>
  database
    .prepare(`SELECT
  (SELECT count(*) FROM company_resource_revisions) AS revisions,
  (SELECT count(*) FROM company_command_receipts) AS receipts,
  (SELECT count(*) FROM company_workforce_resource_bindings) AS bindings,
  (SELECT count(*) FROM company_employee_resource_adoptions) AS adoptions`)
    .first()

describe("existing employee resource adoption", () => {
  const createEmployeeAdoptionFixture = createEmployeeAdoptionFixtureScope()

  test("人物の旧名と全雇用・在籍revisionを保全し、一回だけ接続する", async () => {
    const f = await createEmployeeAdoptionFixture()
    const input = await f.input()
    const before = await f.legacy()
    const response = await f.post(input)
    expect(
      z
        .object({
          employeeId: z.string(),
          organizationRevision: z.number().int().positive(),
          replayed: z.boolean(),
        })
        .strict()
        .parse(await response.json()),
    ).toEqual({
      employeeId: adoptionEmployeeId,
      organizationRevision: 2,
      replayed: false,
    })
    expect(response.status).toBe(200)
    expect(await f.legacy()).toEqual(before)
    expect(await counts(f.database)).toEqual({
      revisions: 5,
      receipts: 2,
      bindings: 2,
      adoptions: 1,
    })
    const receipt = await f.database
      .prepare(
        "SELECT source_json, snapshot_digest, actor_account_id, reason FROM company_employee_resource_adoptions",
      )
      .first<{
        source_json: string
        snapshot_digest: string
        actor_account_id: string
        reason: string
      }>()
    expect(receipt).toMatchObject({
      snapshot_digest: input.snapshotDigest,
      actor_account_id: f.actor.accountId,
      reason: input.reason,
    })
    expect(JSON.parse(receipt?.source_json ?? "{}")).toMatchObject({
      employee: { officialName: "Current Person" },
      lifecycleRevision: 1,
    })
    f.clock.now = new Date("2026-09-08T00:00:00Z")
    expect(await (await f.post(input)).json()).toMatchObject({
      organizationRevision: 2,
      replayed: true,
    })
    expect((await f.post({ ...input, reason: "Another reason" })).status).toBe(409)
    expect(await counts(f.database)).toEqual({
      revisions: 5,
      receipts: 2,
      bindings: 2,
      adoptions: 1,
    })
    expect(
      await f.database
        .prepare(
          "SELECT attributes_json FROM company_resource_revisions WHERE resource_type = 'person' AND revision = 1",
        )
        .first<string>("attributes_json"),
    ).toContain("Former Person")
    expect(
      f.database.exec("UPDATE company_employee_resource_adoptions SET reason = 'changed'"),
    ).rejects.toThrow("immutable")
    expect(f.database.exec("DELETE FROM company_employee_resource_adoptions")).rejects.toThrow(
      "immutable",
    )
  })

  test("接続後の本人連絡先、復職・退職・再入社、公開雇用更新が同じ履歴へ続く", async () => {
    const f = await createEmployeeAdoptionFixture()
    expect((await f.post(await f.input())).status).toBe(200)
    const profile = z
      .object({
        profile: z.object({
          employeeId: z.string(),
          organizationRevision: z.number(),
          personRevision: z.number(),
          effectiveOn: z.string(),
        }),
      })
      .parse(await (await f.app.request("/company/my-profile", {}, f.environment)).json()).profile
    const phone = await f.app.request(
      "/company/my-profile",
      {
        method: "PUT",
        headers: { "content-type": "application/json", "idempotency-key": "adopted-phone" },
        body: JSON.stringify({ profile, reason: "Confirmed phone", phone: "010-1234-5678" }),
      },
      f.environment,
    )
    expect(phone.status).toBe(200)
    expect(
      await f.personnel(
        { kind: "returned", employeeCode: "ADOPT-001", eventOn: restoreCalendarDate("2026-09-07") },
        "adopted-resume",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "ADOPT-001",
          retirementOn: restoreCalendarDate("2026-09-30"),
        },
        "adopted-retire",
      ),
    ).toMatchObject({ replayed: false })
    expect(
      await f.personnel(
        {
          kind: "rehire",
          employeeCode: "ADOPT-001",
          eventOn: restoreCalendarDate("2026-11-01"),
          employmentType: "FULL_TIME",
        },
        "adopted-rehire",
      ),
    ).toMatchObject({ replayed: false })
    const newContract = await f.database
      .prepare(
        "SELECT id FROM company_employments WHERE id <> 'decda03c-f38d-4899-9a9d-30a36ca6fc5e'",
      )
      .first<string>("id")
    const revision = await f.database
      .prepare(
        `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<number>("revision")
    const write = await f.app.request(
      "/company/employments",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-company-organization-id": COMPANY_DEFAULT_ORGANIZATION_ID,
          "if-match": `"${revision}"`,
          "idempotency-key": "adopted-public",
        },
        body: JSON.stringify({
          reason: "Confirmed future leave",
          resources: [
            {
              organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
              type: "employment",
              id: newContract,
              revision: 2,
              state: "active",
              effectiveFrom: "2026-12-01",
              effectiveTo: null,
              attributes: {
                employeeId: adoptionEmployeeId,
                employmentType: "FULL_TIME",
                status: "ON_LEAVE",
              },
            },
          ],
        }),
      },
      f.environment,
    )
    expect(write.status).toBe(201)
    expect(
      await f.database
        .prepare(
          "SELECT resource_revision FROM company_workforce_resource_bindings WHERE resource_id = ?1",
        )
        .bind(newContract)
        .first<number>("resource_revision"),
    ).toBe(2)
  })

  test.each([
    "name",
    "email",
    "code",
    "type",
    "owner",
    "missing-contract",
    "missing-period",
    "person-gap",
    "employee-gap",
  ])("%s の不一致を拒否して台帳と公開履歴を変更しない", async (fault) => {
    const f = await createEmployeeAdoptionFixture()
    const input = await f.input()
    const resources = input.resources.map((r) => ({ ...r, attributes: { ...r.attributes } }))
    if (fault === "name") resources[1]!.attributes.officialName = "Wrong"
    if (fault === "email") resources[1]!.attributes.email = null
    if (fault === "code") resources[2]!.attributes.employeeCode = "WRONG"
    if (fault === "type")
      for (const r of resources.filter((r) => r.type === "employment"))
        r.attributes.employmentType = "FULL_TIME"
    if (fault === "owner")
      resources[4]!.attributes.employeeId = "1953cffc-119b-42c7-bbab-82c56499e4ac"
    if (fault === "person-gap") resources[0]!.effectiveFrom = "2021-01-01"
    if (fault === "employee-gap") resources[2]!.effectiveFrom = "2021-01-01"
    const selected = resources.filter(
      (r) =>
        !(fault === "missing-contract" && r.type === "employment") &&
        !(fault === "missing-period" && r.type === "employment" && r.revision === 2),
    )
    const before = await f.legacy()
    expect((await f.post({ ...input, resources: selected })).status).toBe(422)
    expect(await f.legacy()).toEqual(before)
    expect(await counts(f.database)).toEqual({
      revisions: 0,
      receipts: 0,
      bindings: 0,
      adoptions: 0,
    })
  })

  test("確認後の台帳変更と同じbatch直前の変更、営業日越えを拒否する", async () => {
    const f = await createEmployeeAdoptionFixture()
    const original = await f.input()
    await execSql(
      f.database,
      "UPDATE company_employees SET phone = 'changed' WHERE id = '50737555-5956-4b7d-8755-4e3b9660f143'",
    )
    expect((await f.post(original)).status).toBe(409)
    await execSql(
      f.database,
      "UPDATE company_employees SET phone = NULL WHERE id = '50737555-5956-4b7d-8755-4e3b9660f143'",
    )
    const batch = f.database.batch.bind(f.database)
    const interception = spyOn(f.database, "batch").mockImplementationOnce(async (statements) => {
      await execSql(
        f.database,
        "UPDATE company_employees SET updated_at = 1 WHERE id = '50737555-5956-4b7d-8755-4e3b9660f143'",
      )
      return batch(statements)
    })
    try {
      expect((await f.post(await f.input())).status).toBe(409)
    } finally {
      interception.mockRestore()
    }
    const current = await f.input()
    f.clock.now = new Date("2026-09-08T00:00:00Z")
    expect((await f.post(current)).status).toBe(409)
    expect(await counts(f.database)).toEqual({
      revisions: 0,
      receipts: 0,
      bindings: 0,
      adoptions: 0,
    })
  })

  test("最後の移行証跡保存失敗で全履歴と接続を取り消し、再試行できる", async () => {
    const f = await createEmployeeAdoptionFixture()
    const input = await f.input()
    const before = await f.legacy()
    await execSql(
      f.database,
      "CREATE TRIGGER reject_adoption BEFORE INSERT ON company_employee_resource_adoptions BEGIN SELECT RAISE(ABORT, 'test storage failure'); END;",
    )
    expect((await f.post(input)).status).toBe(503)
    expect(await counts(f.database)).toEqual({
      revisions: 0,
      receipts: 0,
      bindings: 0,
      adoptions: 0,
    })
    expect(await f.legacy()).toEqual(before)
    await execSql(f.database, "DROP TRIGGER reject_adoption")
    expect((await f.post(input)).status).toBe(200)
  })

  test("管理資格とorganizationがない主体は参照・実行できず、未認証も拒否する", async () => {
    const f = await createEmployeeAdoptionFixture()
    const input = await f.input()
    for (const actor of [
      CompanyActorValue.restore({
        accountId: f.actor.accountId,
        employeeId: f.actor.employeeId,
        organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
        capabilities: ["company:write"],
      }),
      CompanyActorValue.restore({
        accountId: f.actor.accountId,
        employeeId: f.actor.employeeId,
        organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
        capabilities: ["company:admin"],
      }),
    ]) {
      f.actors.current = actor
      expect((await f.read()).status).toBe(403)
      expect((await f.post(input)).status).toBe(403)
    }
    f.actors.current = undefined
    expect((await f.read()).status).toBe(401)
    expect((await f.post(input)).status).toBe(401)
  })

  test("期間所有者の不一致をsnapshotに含め、接続を拒否する", async () => {
    const f = await createEmployeeAdoptionFixture()
    await execSql(
      f.database,
      `INSERT INTO company_employees (id, official_name, employee_code, created_at, updated_at) VALUES ('1953cffc-119b-42c7-bbab-82c56499e4ac', 'Other', 'OTHER', 0, 0);
      INSERT INTO company_employment_period_versions (period_id, revision, employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at) SELECT period_id, revision + 1, '1953cffc-119b-42c7-bbab-82c56499e4ac', starts_on, ends_on, is_void, recorded_by_action_id, recorded_at FROM company_employment_period_versions LIMIT 1;`,
    )
    const snapshot = await new EmployeeResourceAdoptionSnapshotAdapter(f.database).find(
      adoptionEmployeeId,
    )
    if (snapshot === null || snapshot instanceof Error) throw new Error("missing snapshot")
    expect(
      snapshot.props.value.employmentPeriods.some(
        (r) => r.employeeId === "1953cffc-119b-42c7-bbab-82c56499e4ac",
      ),
    ).toBe(true)
    expect((await f.post(await f.input())).status).toBe(422)
  })
  test("同じ依頼の同時実行は一回だけ確定し、接続済みの別依頼を競合にする", async () => {
    const f = await createEmployeeAdoptionFixture()
    const input = await f.input()
    const responses = await Promise.all([f.post(input), f.post(input)])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    const receipts = await Promise.all(
      responses.map(
        async (response) =>
          z.object({ replayed: z.boolean() }).parse(await response.json()).replayed,
      ),
    )
    expect(receipts.toSorted((left, right) => Number(left) - Number(right))).toEqual([false, true])
    expect((await f.post(await f.input(), "other-command")).status).toBe(409)
    expect(await counts(f.database)).toEqual({
      revisions: 5,
      receipts: 2,
      bindings: 2,
      adoptions: 1,
    })
  })

  test("退職済みの雇用期間を延長せずに接続する", async () => {
    const f = await createEmployeeAdoptionFixture()
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "ADOPT-001",
          retirementOn: restoreCalendarDate("2026-08-31"),
        },
        "legacy-retired",
      ),
    ).toMatchObject({ replayed: false })
    const input = await f.input()
    const contract = f.resources.find((resource) => resource.type === "employment")
    if (contract === undefined) throw new Error("missing contract")
    const resources = [
      ...input.resources,
      {
        ...contract,
        revision: 3,
        effectiveFrom: "2026-09-01",
        attributes: { ...contract.attributes, status: "TERMINATED" },
      },
    ]
    const before = await f.legacy()
    expect((await f.post({ ...input, resources })).status).toBe(200)
    expect(await f.legacy()).toEqual(before)
    expect(
      await f.database
        .prepare(
          "SELECT termination_date FROM company_employments WHERE id = 'decda03c-f38d-4899-9a9d-30a36ca6fc5e'",
        )
        .first<string>("termination_date"),
    ).toBe("2026-08-31")
  })

  test("履歴のない旧契約は現在の在籍値から推測して接続しない", async () => {
    const f = await createEmployeeAdoptionFixture()
    await execSql(
      f.database,
      `INSERT INTO company_employments (id, employee_id, contract_name, employment_type, hire_date, termination_date, status, created_at, updated_at)
      VALUES ('79ff1a43-4816-49e0-8929-9debe439150d', '50737555-5956-4b7d-8755-4e3b9660f143', 'Old Contract', 'FULL_TIME', '2018-01-01', '2018-12-31', 'TERMINATED', 0, 0);`,
    )
    expect((await f.post(await f.input())).status).toBe(422)
    expect(await counts(f.database)).toEqual({
      revisions: 0,
      receipts: 0,
      bindings: 0,
      adoptions: 0,
    })
  })
  test("Account表示名の不一致と確認後のAccount表示の変更を見逃さない", async () => {
    const f = await createEmployeeAdoptionFixture()
    await execSql(
      f.database,
      "UPDATE company_account_profiles SET display_name = 'Different Person' WHERE account_id = '7a0b75ec-d7b9-4f49-b023-432c8f109a40'",
    )
    expect((await f.post(await f.input())).status).toBe(422)
    await execSql(
      f.database,
      "UPDATE company_account_profiles SET display_name = 'Current Person' WHERE account_id = '7a0b75ec-d7b9-4f49-b023-432c8f109a40'",
    )
    const input = await f.input()
    await execSql(
      f.database,
      "UPDATE company_account_profiles SET updated_at = 1 WHERE account_id = '7a0b75ec-d7b9-4f49-b023-432c8f109a40'",
    )
    expect((await f.post(input)).status).toBe(409)
    expect(await counts(f.database)).toEqual({
      revisions: 0,
      receipts: 0,
      bindings: 0,
      adoptions: 0,
    })
  })
})
