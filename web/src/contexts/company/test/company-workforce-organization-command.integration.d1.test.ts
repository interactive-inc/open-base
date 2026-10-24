import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { deterministicCompanyId } from "@/contexts/company/domain/definitions/deterministic-company-id.definition"
import { z } from "zod"
import { createCompanyAuthorityEmploymentTestContext } from "@/contexts/company/test/company-authority-employment.test-support"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyOrganizationResourceProjectionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-organization-resource-projection.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { readFileSync } from "node:fs"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

async function fixture(type: "office-assignment" | "organizational-authority") {
  const f = await createCompanyAuthorityEmploymentTestContext(type)
  const snapshot = await new D1CompanyResourceRepository({ database: f.database }).findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["employment"],
  })
  if (!snapshot.ok) throw snapshot.cause
  const source = snapshot.resources.find(
    (resource) => resource.id === f.assignment.attributes.employmentId,
  )
  if (source === undefined) throw new Error("employment missing")
  const employment = {
    organizationId: source.organizationId,
    type: "employment" as const,
    id: source.id,
    state: source.state,
    revision: source.revision + 1,
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
  const common = {
    organizationId: f.appointment.organizationId,
    id: f.appointment.id,
    revision: 2,
    state: "active" as const,
    effectiveFrom: f.appointment.effectiveFrom,
    effectiveTo: "2030-07-01",
  }
  const appointment =
    type === "office-assignment"
      ? {
          ...common,
          type,
          attributes: z
            .object({
              employeeId: z.string(),
              employmentId: z.string(),
              organizationalOfficeId: z.string(),
            })
            .parse(f.appointment.attributes),
        }
      : {
          ...common,
          type,
          attributes: z
            .object({
              employeeId: z.string(),
              employmentId: z.string(),
              scopeType: z.enum(["organization-unit", "authority-scope"]),
              scopeId: z.string(),
              authority: z.string(),
            })
            .parse(f.appointment.attributes),
        }
  return {
    ...f,
    employment,
    appointment,
    assignment: { ...f.assignment, revision: 2, effectiveTo: "2030-07-01" },
  }
}

test.each(["office-assignment", "organizational-authority"] as const)(
  "公開APIは雇用・所属・%sの終了と延長を一つのcommandで確定し、再送で増やさない",
  async (type) => {
    const f = await fixture(type)
    const resources = [f.appointment, f.assignment, f.employment]
    const revision = await f.companyRevision()
    expect(Number((await f.write(resources, revision, "workforce:close-together")).status)).toBe(
      201,
    )
    const saved = await f.persisted()
    expect(Number((await f.write(resources, revision, "workforce:close-together")).status)).toBe(
      200,
    )
    expect(await f.persisted()).toEqual(saved)
    expect(await f.publicAssignments("2030-06-30")).toHaveLength(1)
    expect(await f.publicAssignments("2030-07-01")).toEqual([])
    const extended = resources.toReversed().map((resource) => ({
      ...resource,
      revision: resource.revision + 1,
      effectiveTo: "2030-08-01",
    }))
    expect(
      Number(
        (await f.write(extended, await f.companyRevision(), "workforce:extend-together")).status,
      ),
    ).toBe(201)
    expect(await f.publicAssignments("2030-07-31")).toHaveLength(1)
    expect(await f.publicAssignments("2030-08-01")).toEqual([])
    const repository = new D1CompanyResourceRepository({ database: f.database })
    for (const [date, count] of [
      ["2030-07-31", 3],
      ["2030-08-01", 0],
    ] as const) {
      const snapshot = await repository.findMany({
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        types: ["employment", "assignment", type],
        ids: resources.map((resource) => resource.id),
        effectiveOn: restoreCalendarDate(date),
      })
      if (!snapshot.ok) throw snapshot.cause
      expect(snapshot.resources).toHaveLength(count)
    }
  },
)

test.each(["office-assignment", "organizational-authority"] as const)(
  "一括変更に所属・%sの終了が欠けていれば全体を拒否する",
  async (type) => {
    const f = await fixture(type)
    const before = await f.persisted()
    for (const [key, resources] of [
      ["missing-assignment", [f.employment, f.appointment]],
      ["missing-authority", [f.employment, f.assignment]],
    ] as const) {
      expect(Number((await f.write([...resources], await f.companyRevision(), key)).status)).toBe(
        422,
      )
      expect(await f.persisted()).toEqual(before)
    }
    expect(
      await f.database
        .prepare(
          "SELECT count(*) AS count FROM company_organization_change_operations WHERE status = 'PENDING'",
        )
        .first<number>("count"),
    ).toBe(0)
  },
)

test("組織変更の完了が欠ければ、雇用と所属が整合していても確定せず再試行できる", async () => {
  const f = await fixture("organizational-authority")
  const before = await f.persisted()
  const adapter = new CompanyOrganizationResourceProjectionAdapter(f.database)
  const prepare = adapter.prepare.bind(adapter)
  const interception = spyOn(
    CompanyOrganizationResourceProjectionAdapter.prototype,
    "prepare",
  ).mockImplementationOnce(async (change, fingerprint) => {
    const projection = await prepare(change, fingerprint)
    if (projection instanceof Error) return projection
    return {
      beforeWorkforce: projection.beforeWorkforce,
      statements: projection.statements.slice(0, -1),
    }
  })
  const resources = [f.employment, f.assignment, f.appointment]
  const revision = await f.companyRevision()
  try {
    expect(Number((await f.write(resources, revision, "workforce:incomplete")).status)).toBe(422)
  } finally {
    interception.mockRestore()
  }
  expect(await f.persisted()).toEqual(before)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS count FROM company_organization_change_operations WHERE status = 'PENDING'",
      )
      .first<number>("count"),
  ).toBe(0)
  expect(Number((await f.write(resources, revision, "workforce:incomplete")).status)).toBe(201)
})

test("期間保存の失敗では開始した組織変更と人事記録も取り消す", async () => {
  const f = await fixture("office-assignment")
  const before = await f.persisted()
  const resources = [f.employment, f.appointment, f.assignment]
  const revision = await f.companyRevision()
  await execSql(
    f.database,
    "CREATE TRIGGER reject_workforce_assignment BEFORE INSERT ON company_organization_assignment_period_versions WHEN NEW.revision > 1 BEGIN SELECT RAISE(ABORT, 'injected workforce persistence failure'); END;",
  )
  expect(Number((await f.write(resources, revision, "workforce:retry")).status)).toBe(503)
  expect(await f.persisted()).toEqual(before)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS count FROM company_organization_change_operations WHERE status = 'PENDING'",
      )
      .first<number>("count"),
  ).toBe(0)
  await execSql(f.database, "DROP TRIGGER reject_workforce_assignment")
  expect(Number((await f.write(resources, revision, "workforce:retry")).status)).toBe(201)
})

test("同じ版からの同時変更は一方だけ確定し、勝者の再送で履歴を増やさない", async () => {
  const f = await fixture("organizational-authority")
  const revision = await f.companyRevision()
  const resources = [f.employment, f.assignment, f.appointment]
  const responses = await Promise.all([
    f.write(resources, revision, "workforce:first"),
    f.write(resources, revision, "workforce:second"),
  ])
  expect(
    responses.map((response) => Number(response.status)).toSorted((left, right) => left - right),
  ).toEqual([201, 409])
  const saved = await f.persisted()
  const winningKey = responses[0]?.status === 201 ? "workforce:first" : "workforce:second"
  expect(Number((await f.write(resources, revision, winningKey)).status)).toBe(200)
  expect(await f.persisted()).toEqual(saved)
  expect(
    await f.database
      .prepare(
        "SELECT count(*) AS count FROM company_organization_change_operations WHERE status = 'PENDING'",
      )
      .first<number>("count"),
  ).toBe(0)
})

test("公開commandを通らない雇用の直接短縮でも、所属を取り残せない", async () => {
  const f = await fixture("office-assignment")
  const before = await f.database
    .prepare("SELECT * FROM company_employments WHERE id = ?")
    .bind(f.employment.id)
    .first<Record<string, unknown>>()
  const attempted = await f.database
    .prepare("UPDATE company_employments SET termination_date = '2030-06-30' WHERE id = ?")
    .bind(f.employment.id)
    .run()
    .catch((cause: unknown) => cause)
  expect(attempted).toBeInstanceOf(Error)
  if (!(attempted instanceof Error)) throw new Error("Orphan assignment was accepted")
  expect(attempted.message).toContain("employment change would orphan an organization assignment")
  expect(
    await f.database
      .prepare("SELECT * FROM company_employments WHERE id = ?")
      .bind(f.employment.id)
      .first<Record<string, unknown>>(),
  ).toEqual(before)
})

test("人物・従業員・雇用を一つの会社版で確定し、後段の失敗では全体を取り消す", async () => {
  const f = await fixture("office-assignment")
  const repository = new D1CompanyResourceRepository({ database: f.database })
  const snapshot = await repository.findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["person", "employee", "employment"],
  })
  if (!snapshot.ok) throw snapshot.cause
  const employee = snapshot.resources.find(
    (resource) =>
      resource.type === "employee" && resource.id === f.assignment.attributes.employeeId,
  )
  const person = snapshot.resources.find(
    (resource) => resource.type === "person" && resource.id === employee?.readText("personId"),
  )
  const employment = snapshot.resources.find(
    (resource) => resource.type === "employment" && resource.id === f.employment.id,
  )
  if (employee === undefined || person === undefined || employment === undefined)
    throw new Error("workforce resource missing")
  const personAttributes = z
    .object({
      officialName: z.string(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .parse(person.attributes)
  const employeeAttributes = z
    .object({ personId: z.string(), employeeCode: z.string().nullable().optional() })
    .parse(employee.attributes)
  const employmentAttributes = z
    .object({
      employeeId: z.string(),
      status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
      employmentType: z.enum(["FULL_TIME", "PART_TIME"]),
      contractTerm: z
        .discriminatedUnion("kind", [
          z.object({ kind: z.literal("INDEFINITE"), startsOn: z.string() }),
          z.object({ kind: z.literal("FIXED_TERM"), startsOn: z.string(), endsBefore: z.string() }),
        ])
        .nullable()
        .optional(),
      employerLegalEntityId: z.string().nullable().optional(),
      officialName: z.string().optional(),
    })
    .parse(employment.attributes)
  const changedPerson = {
    organizationId: person.organizationId,
    type: "person" as const,
    id: person.id,
    revision: person.revision + 1,
    state: "active" as const,
    effectiveFrom: person.effectiveFrom,
    effectiveTo: person.effectiveTo,
    attributes: { ...personAttributes, officialName: "Updated Worker" },
  }
  const changedEmployee = {
    organizationId: employee.organizationId,
    type: "employee" as const,
    id: employee.id,
    revision: employee.revision + 1,
    state: "active" as const,
    effectiveFrom: employee.effectiveFrom,
    effectiveTo: employee.effectiveTo,
    attributes: { ...employeeAttributes, employeeCode: "EMP-ATOMIC" },
  }
  const changedEmployment = {
    organizationId: employment.organizationId,
    type: "employment" as const,
    id: employment.id,
    revision: employment.revision + 1,
    state: "active" as const,
    effectiveFrom: employment.effectiveFrom,
    effectiveTo: employment.effectiveTo,
    attributes: { ...employmentAttributes, employmentType: "PART_TIME" as const },
  }
  const revision = await f.companyRevision()
  const resources = [changedPerson, changedEmployee, changedEmployment]
  expect(Number((await f.write(resources, revision, "workforce:all")).status)).toBe(201)
  expect(Number((await f.write(resources, revision, "workforce:all")).status)).toBe(200)
  const saved = await repository.findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    organizationRevision: revision + 1,
    types: ["person", "employee", "employment"],
    ids: [person.id, employee.id, employment.id],
  })
  if (!saved.ok) throw saved.cause
  expect(
    saved.resources.find((resource) => resource.type === "person")?.readText("officialName"),
  ).toBe("Updated Worker")
  expect(
    saved.resources.find((resource) => resource.type === "employment")?.readText("employmentType"),
  ).toBe("PART_TIME")
  expect(
    saved.resources.find((resource) => resource.type === "employee")?.readText("employeeCode"),
  ).toBe("EMP-ATOMIC")
  expect(
    await f.database
      .prepare("SELECT official_name FROM company_employees WHERE id = ?")
      .bind(employee.id)
      .first<string>("official_name"),
  ).toBe("Updated Worker")
  expect(
    await f.database
      .prepare("SELECT employee_code FROM company_employees WHERE id = ?")
      .bind(employee.id)
      .first<string>("employee_code"),
  ).toBe("EMP-ATOMIC")
  expect(
    await f.database
      .prepare("SELECT employment_type FROM company_employments WHERE id = ?")
      .bind(employment.id)
      .first<string>("employment_type"),
  ).toBe("PART_TIME")

  const nextPerson = {
    ...changedPerson,
    revision: changedPerson.revision + 1,
    attributes: { ...changedPerson.attributes, officialName: "Should Roll Back" },
  }
  const nextEmployee = {
    ...changedEmployee,
    revision: changedEmployee.revision + 1,
    attributes: { ...changedEmployee.attributes, employeeCode: "EMP-ROLLBACK" },
  }
  const nextEmployment = {
    ...changedEmployment,
    revision: changedEmployment.revision + 1,
    attributes: { ...changedEmployment.attributes, employmentType: "FULL_TIME" as const },
  }
  await execSql(
    f.database,
    "CREATE TRIGGER reject_employment_update BEFORE UPDATE ON company_employments BEGIN SELECT RAISE(ABORT, 'injected employment failure'); END;",
  )
  expect(
    Number(
      (
        await f.write(
          [nextPerson, nextEmployee, nextEmployment],
          revision + 1,
          "workforce:rollback",
        )
      ).status,
    ),
  ).toBe(503)
  expect(await f.companyRevision()).toBe(revision + 1)
  expect(
    await f.database
      .prepare("SELECT official_name FROM company_employees WHERE id = ?")
      .bind(employee.id)
      .first<string>("official_name"),
  ).toBe("Updated Worker")
  expect(
    await f.database
      .prepare("SELECT employee_code FROM company_employees WHERE id = ?")
      .bind(employee.id)
      .first<string>("employee_code"),
  ).toBe("EMP-ATOMIC")
  await execSql(f.database, "DROP TRIGGER reject_employment_update")
  expect(
    Number(
      (
        await f.write(
          [nextPerson, nextEmployee, nextEmployment],
          revision + 1,
          "workforce:rollback",
        )
      ).status,
    ),
  ).toBe(201)
})

test("確定済み公開履歴に未完了の組織変更があれば、migrationは既存情報を保って停止する", async () => {
  const f = await fixture("office-assignment")
  await execSql(f.database, "DROP TRIGGER company_organization_resource_operation_commit_guard")
  const adapter = new CompanyOrganizationResourceProjectionAdapter(f.database)
  const prepare = adapter.prepare.bind(adapter)
  const interception = spyOn(
    CompanyOrganizationResourceProjectionAdapter.prototype,
    "prepare",
  ).mockImplementationOnce(async (change, fingerprint) => {
    const projection = await prepare(change, fingerprint)
    if (projection instanceof Error) return projection
    return {
      beforeWorkforce: projection.beforeWorkforce,
      statements: projection.statements.slice(0, -1),
    }
  })
  try {
    expect(
      Number(
        (
          await f.write(
            [f.employment, f.assignment, f.appointment],
            await f.companyRevision(),
            "workforce:legacy-incomplete",
          )
        ).status,
      ),
    ).toBe(201)
  } finally {
    interception.mockRestore()
  }
  const before = await f.persisted()
  const operations = await f.database
    .prepare("SELECT * FROM company_organization_change_operations ORDER BY id")
    .all<{ status: string }>()
  expect(operations.results.filter((row) => row.status === "PENDING")).toHaveLength(1)
  const schema = readFileSync(
    new URL("../infrastructure/schema/company.sql", import.meta.url),
    "utf8",
  )
  const marker = "SELECT json_extract('{}', 'company_organization_resource_operation_incomplete')"
  expect(schema.includes(marker)).toBe(true)
  const attempted = await f.database
    .batch(
      splitSqlStatements(schema.slice(schema.indexOf(marker))).map((statement) =>
        f.database.prepare(statement),
      ),
    )
    .catch((cause: unknown) => cause)
  expect(attempted).toBeInstanceOf(Error)
  if (!(attempted instanceof Error))
    throw new Error("Incomplete organization operation was accepted")
  expect(attempted.message).toContain("company_organization_resource_operation_incomplete")
  expect(await f.persisted()).toEqual(before)
  expect(
    (
      await f.database
        .prepare("SELECT * FROM company_organization_change_operations ORDER BY id")
        .all<{ status: string }>()
    ).results,
  ).toEqual(operations.results)
})

test.each(["responsibility", "manager"] as const)(
  "一括変更でも未接続の%sを期間外へ取り残さない",
  async (kind) => {
    const f = await fixture("office-assignment")
    const revision = await f.database
      .prepare("SELECT revision FROM company_organization_lifecycle_states WHERE id = 1")
      .first<number>("revision")
    if (revision === null) throw new Error("organization revision missing")
    const other = f.people[1]
    if (other === undefined) throw new Error("other employee missing")
    const otherEmployment = await f.database
      .prepare("SELECT id FROM company_employments WHERE employee_id = ?")
      .bind(other.employeeId)
      .first<{ id: string }>()
    if (otherEmployment === null) throw new Error("other employment missing")
    const operationId = deterministicCompanyId("test-operation", `legacy:${kind}`)
    const legacyPeriod =
      kind === "responsibility"
        ? f.database
            .prepare(`
    INSERT INTO company_organization_responsibility_period_versions
      (period_id, revision, employment_id, employee_id, organization_unit_id, responsibility_type,
       starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
    VALUES (?1, 1, ?2, ?3, ?4, 'PEOPLE_OPERATIONS', '2030-03-01', NULL, 0, ?5, ?6)
  `)
            .bind(
              `legacy-period:${kind}`,
              f.employment.id,
              f.employment.attributes.employeeId,
              f.assignment.attributes.organizationUnitId,
              operationId,
              f.at.getTime(),
            )
        : f.database
            .prepare(`
    INSERT INTO company_organization_assignment_period_versions
      (period_id, revision, employment_id, employee_id, organization_unit_id, assignment_type,
       position_title, manager_employee_id, starts_on, ends_on, is_void, recorded_by_action_id, recorded_at)
    VALUES (?1, 1, ?2, ?3, ?4, 'PRIMARY', NULL, ?5, '2030-03-01', NULL, 0, ?6, ?7)
  `)
            .bind(
              `legacy-period:${kind}`,
              otherEmployment.id,
              other.employeeId,
              f.assignment.attributes.organizationUnitId,
              f.employment.attributes.employeeId,
              operationId,
              f.at.getTime(),
            )
    await f.database.batch([
      f.database
        .prepare(`INSERT INTO company_organization_change_operations
      (id, expected_revision, change_count, applied_count, resulting_revision, status, recorded_at,
       actor_account_id, reason, evidence_references_json, request_fingerprint)
      VALUES (?1, ?2, 1, 0, ?2 + 1, 'PENDING', ?3, ?4, 'Confirm existing organization history', '[]', ?5)
    `)
        .bind(operationId, revision, f.at.getTime(), f.creator.accountId, "b".repeat(64)),
      legacyPeriod,
      f.database
        .prepare(
          "UPDATE company_organization_change_operations SET status = 'COMPLETED' WHERE id = ?",
        )
        .bind(operationId),
    ])
    const before = await f.persisted()
    expect(
      Number(
        (
          await f.write(
            [f.employment, f.assignment, f.appointment],
            await f.companyRevision(),
            `workforce:legacy-${kind}`,
          )
        ).status,
      ),
    ).toBe(422)
    expect(await f.persisted()).toEqual(before)
  },
)
