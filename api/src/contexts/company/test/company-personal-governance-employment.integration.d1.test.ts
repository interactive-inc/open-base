import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { z } from "zod"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyGovernanceAuthorityResolutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-governance-authority-resolution.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture(type: "responsibility-assignment" | "collective-body-membership") {
  const f = await createCompanyAssignmentResourceTestContext()
  await f.assignEmployeeCode()
  const common = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    id: "governance:personal",
    revision: 1,
    state: "active" as const,
    effectiveFrom: "2030-03-01",
    effectiveTo: null,
  }
  const resource =
    type === "responsibility-assignment"
      ? {
          ...common,
          type,
          attributes: {
            responsibilityId: "responsibility:approve",
            holderType: "employee" as const,
            holderId: f.creator.employeeId,
            authorityScopeId: "scope:amount",
            delegationAllowed: false,
          },
        }
      : {
          ...common,
          type,
          attributes: {
            collectiveBodyId: "body:committee",
            employeeId: f.creator.employeeId,
            role: "member" as const,
            voting: true,
          },
        }
  expect(
    Number((await f.write([resource], await f.companyRevision(), "personal:create")).status),
  ).toBe(201)
  const repository = new D1CompanyResourceRepository({ database: f.database })
  const resolve = async (date: string) => {
    const resolved = await new CompanyGovernanceAuthorityResolutionAdapter({
      repository,
      readActiveAccountIds: async (accountIds) =>
        new Set(
          accountIds.filter((accountId) =>
            f.people.some((person) => person.accountId === accountId),
          ),
        ),
    }).resolve({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      asOf: restoreCalendarDate(date),
      subjectEmployeeId: null,
      criteria: [
        {
          responsibilityCode: "APPROVE",
          scope: { scopeType: "amount", currencyCode: "JPY", amount: 500 },
        },
      ],
    })
    if (resolved.kind === "invalid") throw resolved.error
    if (resolved.kind === "unavailable") throw resolved.cause
    return resolved.resolution.candidates.some(
      (candidate) => candidate.accountId === f.creator.accountId,
    )
  }
  const read = async (date: string) => {
    const snapshot = await repository.findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: [type],
      ids: [resource.id],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!snapshot.ok) throw snapshot.cause
    return snapshot.resources
  }
  const employments = await repository.findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employment"],
  })
  if (!employments.ok) throw employments.cause
  const source = employments.resources.find(
    (resource) => resource.readText("employeeId") === f.creator.employeeId,
  )
  if (source === undefined) throw new Error("employment missing")
  const employment = {
    organizationId: source.organizationId,
    type: "employment" as const,
    id: source.id,
    revision: source.revision + 1,
    state: "active" as const,
    effectiveFrom: source.effectiveFrom,
    effectiveTo: "2030-07-01",
    attributes: z
      .object({
        employeeId: z.string(),
        status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
        employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
      })
      .parse(source.attributes),
  }
  const retained = async () => {
    const snapshot = await repository.findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["responsibility-assignment", "collective-body-membership", "collective-body"],
      ids: ["assignment:approve", "membership:0", "membership:1", "membership:2", "body:committee"],
    })
    if (!snapshot.ok) throw snapshot.cause
    return snapshot.resources
  }
  return { ...f, resource, employment, repository, resolve, read, retained }
}

test.each(["responsibility-assignment", "collective-body-membership"] as const)(
  "退職後の再入社で%sによる以前の判断資格を復活させない",
  async (type) => {
    const f = await fixture(type)
    const retained = await f.retained()
    expect(await f.resolve("2030-06-30")).toBe(true)
    expect(
      await f.personnel(
        {
          kind: "retired",
          employeeCode: "EMPLOYEE-001",
          retirementOn: restoreCalendarDate("2030-06-30"),
        },
        "personal:retire",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.resolve("2030-07-01")).toBe(false)
    expect(
      await f.personnel(
        {
          kind: "rehire",
          employeeCode: "EMPLOYEE-001",
          eventOn: restoreCalendarDate("2030-09-01"),
          employmentType: "FULL_TIME",
        },
        "personal:rehire",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.resolve("2030-09-01")).toBe(false)
    expect(await f.read("2030-06-30")).toHaveLength(1)
    expect(await f.read("2030-07-01")).toEqual([])
    const history = await f.repository.findEmploymentDependentHistory(
      COMPANY_DEFAULT_ORGANIZATION_ID,
      await f.companyRevision(),
    )
    if (history instanceof Error) throw history
    const head = history
      .filter((resource) => resource.type === type && resource.id === f.resource.id)
      .toSorted((left, right) => right.revision - left.revision)[0]
    if (head === undefined) throw new Error("personal assignment missing")
    expect(
      Number(
        (
          await f.write(
            [{ ...f.resource, revision: head.revision + 1, effectiveFrom: "2030-09-01" }],
            await f.companyRevision(),
            "personal:reappoint",
          )
        ).status,
      ),
    ).toBe(201)
    expect(await f.resolve("2030-09-01")).toBe(true)
    expect(await f.retained()).toEqual(retained)
  },
)

test.each(["responsibility-assignment", "collective-body-membership"] as const)(
  "公開APIは将来取消のある%sも検査し、雇用との同時終了・延長を原子的に保存する",
  async (type) => {
    const f = await fixture(type)
    expect(
      Number(
        (
          await f.write(
            [{ ...f.resource, revision: 2, state: "void", effectiveFrom: "2030-09-01" }],
            await f.companyRevision(),
            "personal:reserve-end",
          )
        ).status,
      ),
    ).toBe(201)
    const before = await f.persisted()
    const revision = await f.companyRevision()
    expect(Number((await f.write([f.employment], revision, "personal:orphan")).status)).toBe(422)
    expect(await f.persisted()).toEqual(before)
    const resources = [f.employment, { ...f.resource, revision: 3, effectiveTo: "2030-07-01" }]
    expect(Number((await f.write(resources, revision, "personal:close")).status)).toBe(201)
    const saved = await f.persisted()
    expect(Number((await f.write(resources, revision, "personal:close")).status)).toBe(200)
    expect(await f.persisted()).toEqual(saved)
    expect(await f.read("2030-07-01")).toEqual([])
    const extended = resources.toReversed().map((resource) => ({
      ...resource,
      revision: resource.revision + 1,
      effectiveTo: "2030-08-01",
    }))
    expect(
      Number((await f.write(extended, await f.companyRevision(), "personal:extend")).status),
    ).toBe(201)
    expect(await f.read("2030-07-31")).toHaveLength(1)
    expect(await f.read("2030-08-01")).toEqual([])
  },
)

test.each(["responsibility-assignment", "collective-body-membership"] as const)(
  "%sの保存失敗で退職を巻き戻し、訂正で元の判断資格を新しい退職日まで保つ",
  async (type) => {
    const f = await fixture(type)
    const retirement = {
      kind: "retired" as const,
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    }
    const before = await f.persisted()
    await execSql(
      f.database,
      `CREATE TRIGGER reject_personal_governance BEFORE INSERT ON company_resource_revisions WHEN NEW.resource_type = '${type}' BEGIN SELECT RAISE(ABORT, 'injected personal governance failure'); END;`,
    )
    expect(await f.personnel(retirement, "personal:failed-exit")).toBeInstanceOf(Error)
    expect(await f.persisted()).toEqual(before)
    await execSql(f.database, "DROP TRIGGER reject_personal_governance")
    const retired = await f.personnel(retirement, "personal:failed-exit")
    if (retired instanceof Error) throw retired
    const saved = await f.persisted()
    expect(await f.personnel(retirement, "personal:failed-exit")).toMatchObject({ replayed: true })
    expect(await f.persisted()).toEqual(saved)
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: retired.action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Confirm corrected retirement",
          replacementAction: { ...retirement, retirementOn: restoreCalendarDate("2030-07-31") },
        },
        "personal:correct",
      ),
    ).toMatchObject({ replayed: false })
    expect(await f.resolve("2030-07-31")).toBe(true)
    expect(await f.read("2030-08-01")).toEqual([])
  },
)

test.each(["responsibility-assignment", "collective-body-membership"] as const)(
  "%sの退職後の手動編集を、退職日の訂正で上書きしない",
  async (type) => {
    const f = await fixture(type)
    const retirement = {
      kind: "retired" as const,
      employeeCode: "EMPLOYEE-001",
      retirementOn: restoreCalendarDate("2030-06-30"),
    }
    const retired = await f.personnel(retirement, "personal:exit")
    if (retired instanceof Error) throw retired
    const history = await f.repository.findEmploymentDependentHistory(
      COMPANY_DEFAULT_ORGANIZATION_ID,
      await f.companyRevision(),
    )
    if (history instanceof Error) throw history
    const last = history
      .filter((resource) => resource.type === type && resource.id === f.resource.id)
      .toSorted((left, right) => right.revision - left.revision)[0]
    if (last === undefined) throw new Error("appointment missing")
    expect(
      Number(
        (
          await f.write(
            [
              {
                ...f.resource,
                revision: last.revision + 1,
                state: "void",
                effectiveFrom: "2030-06-15",
              },
            ],
            await f.companyRevision(),
            "personal:manual-end",
          )
        ).status,
      ),
    ).toBe(201)
    const before = await f.persisted()
    expect(
      await f.personnel(
        {
          kind: "corrected",
          correctsActionId: retired.action.id,
          eventOn: restoreCalendarDate("2030-06-01"),
          reason: "Correct retirement after manual change",
          replacementAction: { ...retirement, retirementOn: restoreCalendarDate("2030-07-31") },
        },
        "personal:stale-correction",
      ),
    ).toMatchObject({ code: "personnel_action_stale" })
    expect(await f.persisted()).toEqual(before)
  },
)

test("migrationは既存の雇用期間外の個人責務を検出し、情報と既存の制約を保つ", async () => {
  const f = await fixture("responsibility-assignment")
  for (const trigger of [
    "company_employment_authority_commit_guard",
    "company_employment_authority_projection_guard",
    "company_employment_authority_organization_guard",
  ]) {
    await execSql(f.database, `DROP TRIGGER ${trigger}`)
  }
  expect(
    Number(
      (await f.write([f.employment], await f.companyRevision(), "personal:legacy-orphan")).status,
    ),
  ).toBe(201)
  const before = await f.persisted()
  const view = () =>
    f.database
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'view' AND name = 'company_employment_authority_violations'",
      )
      .first<string>("sql")
  const original = await view()
  const schema = readFileSync(
    new URL("../infrastructure/schema/company.sql", import.meta.url),
    "utf8",
  )
  const marker = schema.indexOf("company_personal_governance_period_not_covered")
  const start = schema.lastIndexOf("WITH effective_versions AS (", marker)
  expect(start).toBeGreaterThanOrEqual(0)
  const attempted = await f.database
    .batch(
      splitSqlStatements(schema.slice(start)).map((statement) => f.database.prepare(statement)),
    )
    .catch((cause: unknown) => cause)
  expect(attempted).toBeInstanceOf(Error)
  if (!(attempted instanceof Error)) throw new Error("Invalid existing governance was accepted")
  expect(attempted.message).toContain("company_personal_governance_period_not_covered")
  expect(await view()).toBe(original)
  expect(await f.persisted()).toEqual(before)
})
