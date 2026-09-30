import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { z } from "zod"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyChangeFeedRepository } from "@/contexts/company/infrastructure/repositories/core/company-change-feed.repository"
import { createCompanyEmployerTestContext } from "@/contexts/company/test/company-employer.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("個別雇用APIも契約を保存し、履歴保存の失敗を全取消しして再試行できる", async () => {
  const f = await createCompanyEmployerTestContext()
  expect(
    Number((await f.write([f.legalEntity], await f.companyRevision(), "contract:employer")).status),
  ).toBe(201)
  const header = {
    "idempotency-key": "contract:individual",
    "if-match": String(await f.companyRevision()),
    "x-company-organization-id": f.employment.organizationId,
  }
  const resource = {
    ...f.employment,
    attributes: {
      ...f.employment.attributes,
      contractTerm: { kind: z.literal("INDEFINITE").parse("INDEFINITE"), startsOn: "2030-01-01" },
    },
  }
  const json = { reason: "Confirm employment contract", resources: [resource] }
  const before = await f.persisted()
  await execSql(
    f.database,
    "CREATE TRIGGER test_contract_history_failure BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = 'employment' BEGIN SELECT RAISE(ABORT, 'test_contract_history_failure'); END;",
  )
  expect(Number((await f.client.employments.$post({ header, json })).status)).toBe(503)
  expect(await f.persisted()).toEqual(before)
  await execSql(f.database, "DROP TRIGGER test_contract_history_failure")
  expect(Number((await f.client.employments.$post({ header, json })).status)).toBe(201)
  const snapshot = await new D1CompanyResourceRepository({ database: f.database }).findMany({
    organizationId: f.employment.organizationId,
    organizationRevision: await f.companyRevision(),
    effectiveOn: restoreCalendarDate("2030-06-01"),
    types: ["employment"],
    ids: [f.employment.id],
  })
  if (!snapshot.ok) throw snapshot.cause
  expect(snapshot.resources[0]?.attributes["contractTerm"]).toEqual(
    resource.attributes.contractTerm,
  )
  const saved = await f.persisted()
  expect(Number((await f.client.employments.$post({ header, json })).status)).toBe(200)
  expect(await f.persisted()).toEqual(saved)
})

test("休職・復職と将来の契約更新を同じ雇用履歴に保持する", async () => {
  const f = await createCompanyEmployerTestContext()
  const fixedTerm = {
    kind: z.literal("FIXED_TERM").parse("FIXED_TERM"),
    startsOn: "2030-01-01",
    endsBefore: "2031-01-01",
  }
  const initial = {
    ...f.employment,
    attributes: { ...f.employment.attributes, contractTerm: fixedTerm },
  }
  const renewal = {
    ...initial,
    revision: initial.revision + 1,
    effectiveFrom: "2030-09-01",
    attributes: {
      ...initial.attributes,
      contractTerm: {
        kind: z.literal("INDEFINITE").parse("INDEFINITE"),
        startsOn: "2030-09-01",
      },
    },
  }
  expect(
    Number(
      (
        await f.write(
          [f.legalEntity, initial],
          await f.companyRevision(),
          "contract:initial-before-leave",
        )
      ).status,
    ),
  ).toBe(201)
  expect(
    Number((await f.write([renewal], await f.companyRevision(), "contract:future")).status),
  ).toBe(201)
  for (const input of [
    {
      kind: "leave_started" as const,
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-07-01"),
    },
    {
      kind: "returned" as const,
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-08-01"),
    },
  ]) {
    const applied = await f.personnel(input, `contract:${input.kind}`)
    if (applied instanceof Error) throw applied
  }
  const repository = new D1CompanyResourceRepository({ database: f.database })
  for (const scenario of [
    { date: "2030-07-01", status: "ON_LEAVE", contractTerm: fixedTerm },
    { date: "2030-08-01", status: "ACTIVE", contractTerm: fixedTerm },
    { date: "2030-09-01", status: "ACTIVE", contractTerm: renewal.attributes.contractTerm },
  ]) {
    const snapshot = await repository.findMany({
      organizationId: initial.organizationId,
      organizationRevision: await f.companyRevision(),
      effectiveOn: restoreCalendarDate(scenario.date),
      types: ["employment"],
      ids: [initial.id],
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(snapshot.resources[0]?.attributes["status"]).toBe(scenario.status)
    expect(snapshot.resources[0]?.attributes["contractTerm"]).toEqual(scenario.contractTerm)
  }
})

test("将来の契約更新を取消しても旧会社版から取消前の内容を取得できる", async () => {
  const f = await createCompanyEmployerTestContext()
  const fixedTerm = {
    kind: z.literal("FIXED_TERM").parse("FIXED_TERM"),
    startsOn: "2030-01-01",
    endsBefore: "2031-01-01",
  }
  const initial = {
    ...f.employment,
    attributes: { ...f.employment.attributes, contractTerm: fixedTerm },
  }
  expect(
    Number(
      (
        await f.write(
          [f.legalEntity, initial],
          await f.companyRevision(),
          "contract:cancellation-initial",
        )
      ).status,
    ),
  ).toBe(201)
  const renewal = {
    ...initial,
    revision: initial.revision + 1,
    effectiveFrom: "2031-01-01",
    attributes: {
      ...initial.attributes,
      contractTerm: {
        kind: z.literal("INDEFINITE").parse("INDEFINITE"),
        startsOn: "2031-01-01",
      },
    },
  }
  expect(
    Number(
      (await f.write([renewal], await f.companyRevision(), "contract:cancellation-renewal")).status,
    ),
  ).toBe(201)
  const renewalRevision = await f.companyRevision()
  const cancellation = {
    ...renewal,
    revision: renewal.revision + 1,
    attributes: { ...renewal.attributes, contractTerm: fixedTerm },
  }
  expect(
    Number(
      (await f.write([cancellation], renewalRevision, "contract:cancellation-confirmed")).status,
    ),
  ).toBe(201)
  const repository = new D1CompanyResourceRepository({ database: f.database })
  for (const scenario of [
    { organizationRevision: renewalRevision, contractTerm: renewal.attributes.contractTerm },
    { organizationRevision: await f.companyRevision(), contractTerm: fixedTerm },
  ]) {
    const snapshot = await repository.findMany({
      organizationId: initial.organizationId,
      organizationRevision: scenario.organizationRevision,
      effectiveOn: restoreCalendarDate("2031-01-01"),
      types: ["employment"],
      ids: [initial.id],
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(snapshot.resources[0]?.attributes["contractTerm"]).toEqual(scenario.contractTerm)
  }
})

test("契約更新を会社版へ追記し、未記録・過去版・現在・将来と在籍状態を保つ", async () => {
  const f = await createCompanyEmployerTestContext()
  const beforeRevision = await f.companyRevision()
  const initial = {
    ...f.employment,
    attributes: {
      ...f.employment.attributes,
      contractTerm: {
        kind: z.literal("FIXED_TERM").parse("FIXED_TERM"),
        startsOn: "2030-01-01",
        endsBefore: "2031-01-01",
      },
    },
  }
  expect(
    Number((await f.write([f.legalEntity, initial], beforeRevision, "contract:initial")).status),
  ).toBe(201)
  const confirmedRevision = await f.companyRevision()
  const renewal = {
    ...initial,
    revision: initial.revision + 1,
    effectiveFrom: "2031-01-01",
    attributes: {
      ...initial.attributes,
      contractTerm: { kind: z.literal("INDEFINITE").parse("INDEFINITE"), startsOn: "2031-01-01" },
    },
  }
  expect(Number((await f.write([renewal], confirmedRevision, "contract:renewal")).status)).toBe(201)
  const repository = new D1CompanyResourceRepository({ database: f.database })
  const changePage = await new CompanyChangeFeedRepository(f.database).list({
    organizationId: initial.organizationId,
    afterRevision: confirmedRevision,
    afterType: null,
    afterId: null,
    afterResourceRevision: null,
    throughRevision: null,
    limit: 100,
  })
  if (changePage instanceof Error) throw changePage
  expect(changePage.changes).toContainEqual(
    expect.objectContaining({
      organization_revision: await f.companyRevision(),
      resource_type: "employment",
      resource_id: initial.id,
      revision: renewal.revision,
    }),
  )
  for (const scenario of [
    { date: "2030-06-01", revision: beforeRevision, term: undefined },
    {
      date: "2030-06-01",
      revision: await f.companyRevision(),
      term: initial.attributes.contractTerm,
    },
    { date: "2031-01-01", revision: confirmedRevision, term: initial.attributes.contractTerm },
    {
      date: "2031-01-01",
      revision: await f.companyRevision(),
      term: renewal.attributes.contractTerm,
    },
  ]) {
    const snapshot = await repository.findMany({
      organizationId: initial.organizationId,
      organizationRevision: scenario.revision,
      effectiveOn: restoreCalendarDate(scenario.date),
      types: ["employment"],
      ids: [initial.id],
    })
    expect(snapshot.ok).toBe(true)
    if (!snapshot.ok) throw snapshot.cause
    if (scenario.term === undefined) {
      expect(snapshot.resources[0]?.attributes["contractTerm"]).toBeUndefined()
    } else {
      expect(snapshot.resources[0]?.attributes["contractTerm"]).toEqual(scenario.term)
    }
    expect(snapshot.resources[0]?.attributes["status"]).toBe("ACTIVE")
  }
  const persisted = await f.persisted()
  expect(Number((await f.write([renewal], confirmedRevision, "contract:renewal")).status)).toBe(200)
  expect(await f.persisted()).toEqual(persisted)
  expect(Number((await f.write([renewal], confirmedRevision, "contract:stale")).status)).toBe(409)
  expect(await f.persisted()).toEqual(persisted)
})

test("退職と遡及訂正は契約を保持し、再入社の契約は推測で引き継がない", async () => {
  const f = await createCompanyEmployerTestContext()
  const contractTerm = {
    kind: z.literal("FIXED_TERM").parse("FIXED_TERM"),
    startsOn: "2030-01-01",
    endsBefore: "2031-01-01",
  }
  expect(
    Number(
      (
        await f.write(
          [
            f.legalEntity,
            { ...f.employment, attributes: { ...f.employment.attributes, contractTerm } },
          ],
          await f.companyRevision(),
          "contract:lifecycle",
        )
      ).status,
    ),
  ).toBe(201)
  const retired = await f.personnel(
    {
      kind: "retired",
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
    "contract:retire",
  )
  if (retired instanceof Error) throw retired
  const retiredRevision = await f.companyRevision()
  const corrected = await f.personnel(
    {
      kind: "corrected",
      eventOn: restoreCalendarDate("2030-06-01"),
      correctsActionId: retired.action.id,
      reason: "Correct retirement date",
      replacementAction: {
        kind: "retired",
        employeeCode: "EMPLOYEE-001",
        retirementOn: restoreCalendarDate("2030-07-31"),
      },
    },
    "contract:correct-retirement",
  )
  if (corrected instanceof Error) throw corrected
  const repository = new D1CompanyResourceRepository({ database: f.database })
  for (const scenario of [
    { revision: retiredRevision, status: "TERMINATED" },
    { revision: await f.companyRevision(), status: "ACTIVE" },
  ]) {
    const snapshot = await repository.findMany({
      organizationId: f.employment.organizationId,
      organizationRevision: scenario.revision,
      effectiveOn: restoreCalendarDate("2030-07-01"),
      types: ["employment"],
      ids: [f.employment.id],
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(snapshot.resources[0]?.attributes["contractTerm"]).toEqual(contractTerm)
    expect(snapshot.resources[0]?.attributes["status"]).toBe(scenario.status)
  }
  const rehired = await f.personnel(
    {
      kind: "rehire",
      employeeCode: "EMPLOYEE-001",
      eventOn: restoreCalendarDate("2030-09-01"),
      employmentType: "FULL_TIME",
    },
    "contract:rehire",
  )
  if (rehired instanceof Error) throw rehired
  const snapshot = await repository.findMany({
    organizationId: f.employment.organizationId,
    organizationRevision: await f.companyRevision(),
    effectiveOn: restoreCalendarDate("2030-09-01"),
    types: ["employment"],
  })
  if (!snapshot.ok) throw snapshot.cause
  const newEmployment = snapshot.resources.filter(
    (resource) =>
      resource.id !== f.employment.id &&
      resource.attributes["employeeId"] === f.employment.attributes.employeeId,
  )
  expect(newEmployment).toHaveLength(1)
  expect(newEmployment[0]?.attributes["contractTerm"]).toBeUndefined()
  expect(
    snapshot.resources.find((resource) => resource.id === f.employment.id)?.attributes[
      "contractTerm"
    ],
  ).toEqual(contractTerm)
})
