import { execSql } from "@system/test/local-d1/exec-sql.test-support"
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { readFileSync } from "node:fs"
import { validateCompanyOrganizationChange } from "@/contexts/company/domain/policies/company-organization.policy"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { testLiteralId } from "@system/test/system-test-id.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const firstRootPeriodId = testLiteralId("period:root:first")
const nextRootPeriodId = testLiteralId("period:root:next")

const schema =
  readFileSync(
    new URL("../../../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../../schema/company.sql", import.meta.url), "utf8")
const effectiveFrom = restoreCalendarDate("2026-01-01")

const person: CompanyResourceProps = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  type: "person",
  id: "person:1",
  revision: 1,
  state: "active",
  effectiveFrom,
  effectiveTo: null,
  attributes: { officialName: "Example Person" },
}
const employee: CompanyResourceProps = {
  ...person,
  type: "employee",
  id: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
  attributes: { personId: person.id, employeeCode: "E001" },
}
const employment: CompanyResourceProps = {
  ...person,
  type: "employment",
  id: "4b97a400-e084-4aa7-9ec9-c3344438b6c8",
  attributes: { employeeId: employee.id, status: "ACTIVE", employmentType: "FULL_TIME" },
}
const assignment: CompanyResourceProps = {
  ...person,
  type: "assignment",
  id: "4d97c3a4-cd21-4db1-b20c-9766c3a051f3",
  attributes: {
    employeeId: employee.id,
    employmentId: employment.id,
    organizationUnitId: "0190005f-0000-7000-8000-2fcb85764fe2",
    assignmentType: "PRIMARY",
  },
}
const organizationUnit: CompanyResourceProps = {
  ...person,
  type: "organization-unit",
  id: "0190005f-0000-7000-8000-2fcb85764fe2",
  attributes: {
    organizationUnitId: "0190005f-0000-7000-8000-2fcb85764fe2",
    code: "ROOT",
    officialName: "Example Organization",
    kind: "COMPANY",
    parentOrganizationUnitId: null,
  },
}

function command(
  resources: ReadonlyArray<CompanyResourceProps>,
  expectedRevision = 0,
  commandId = `command:${expectedRevision + 1}`,
): CompanyResourceChangeEntity {
  const result = CompanyResourceChangeEntity.create({
    resources,
    commandId,
    expectedRevision,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "従業員台帳の変更",
    recordedAt: Date.parse("2026-09-06T00:00:00Z"),
  })
  if (result instanceof Error) throw result
  return result
}

async function fixture() {
  const database = await createLocalD1Database({ schema })
  return { database, repository: new D1CompanyResourceRepository({ database }) }
}

test.each(["organization-reference", "employment-authority"] as const)(
  "%sの不整合をmigrationが検出しても既存の履歴を削除・補完しない",
  async (kind) => {
    const { database, repository } = await fixture()
    expect(
      await repository.write(command([person, employee, employment, organizationUnit])),
    ).toMatchObject({ kind: "applied" })
    await execSql(database, "DROP TRIGGER company_authority_scope_reference_guard")
    await execSql(database, "DROP TRIGGER company_governance_organization_revision_guard")
    await execSql(database, "DROP TRIGGER company_employment_authority_commit_guard")
    await execSql(database, "DROP TRIGGER company_governance_reference_period_commit_guard")
    const invalid: CompanyResourceProps =
      kind === "organization-reference"
        ? {
            ...person,
            type: "authority-scope",
            id: "scope:unconfirmed",
            attributes: {
              scopeType: "organization-unit",
              scopeId: "0190005f-0000-7000-8000-279426d9e995",
            },
          }
        : {
            ...person,
            type: "organizational-authority",
            id: "authority:unconfirmed",
            attributes: {
              employeeId: employee.id,
              employmentId: employment.id,
              scopeType: "organization-unit",
              scopeId: organizationUnit.id,
              authority: "approve",
            },
          }
    expect(await repository.write(command([invalid], 1))).toMatchObject({ kind: "applied" })
    const before = (
      await database
        .prepare(
          "SELECT * FROM company_resource_revisions ORDER BY organization_revision, resource_type, resource_id",
        )
        .all()
    ).results
    expect(
      (
        await database
          .prepare(
            kind === "organization-reference"
              ? "SELECT * FROM company_governance_organization_reference_violations"
              : "SELECT * FROM company_employment_authority_violations",
          )
          .all()
      ).results,
    ).toHaveLength(1)
    const marker = "DROP VIEW IF EXISTS company_governance_organization_reference_violations;"
    expect(schema.includes(marker)).toBe(true)
    const attempted = await database
      .batch(
        splitSqlStatements(schema.slice(schema.indexOf(marker))).map((statement) =>
          database.prepare(statement),
        ),
      )
      .catch((cause: unknown) => cause)
    expect(attempted).toBeInstanceOf(Error)
    if (!(attempted instanceof Error)) throw new Error("Invalid existing history was accepted")
    expect(attempted.message).toContain(
      kind === "organization-reference"
        ? "company_governance_organization_reference_invalid"
        : "company_employment_authority_period_not_covered",
    )
    expect(
      (
        await database
          .prepare(
            "SELECT * FROM company_resource_revisions ORDER BY organization_revision, resource_type, resource_id",
          )
          .all()
      ).results,
    ).toEqual(before)
  },
)

test.each(["organizational-office", "authority-scope"] as const)(
  "%sは組織IDと連続期間を参照し、期間ID・空白・参照中の組織短縮を拒否する",
  async (type) => {
    const { repository, database } = await fixture()
    const unit = {
      ...organizationUnit,
      id: firstRootPeriodId,
      effectiveTo: restoreCalendarDate("2026-07-01"),
    }
    const continuation = {
      ...organizationUnit,
      id: nextRootPeriodId,
      effectiveFrom: restoreCalendarDate("2026-07-01"),
    }
    const position: CompanyResourceProps = {
      ...person,
      type: "position",
      id: "position:scope",
      attributes: { code: "LEAD", officialName: "Lead" },
    }
    const target: CompanyResourceProps =
      type === "organizational-office"
        ? {
            ...person,
            type,
            id: "target:scope",
            attributes: {
              code: "LEAD",
              officialName: "Lead",
              organizationUnitId: "0190005f-0000-7000-8000-2fcb85764fe2",
              positionId: position.id,
            },
          }
        : {
            ...person,
            type,
            id: "target:scope",
            attributes: {
              scopeType: "organization-unit",
              scopeId: "0190005f-0000-7000-8000-2fcb85764fe2",
            },
          }
    const valid = command([unit, continuation, position, target])
    expect(validateCompanyOrganizationChange([], valid, [])).toBeNull()
    const gap = command([
      { ...unit, effectiveTo: restoreCalendarDate("2026-06-30") },
      continuation,
      position,
      target,
    ])
    expect(validateCompanyOrganizationChange([], gap, [])).toBeInstanceOf(Error)
    expect(await repository.write(gap)).toMatchObject({ kind: "invalid" })
    expect((await counts(database))?.heads).toBe(0)
    expect(await repository.write(valid)).toMatchObject({ kind: "applied" })
    const before = await counts(database)
    const falseId =
      type === "organizational-office"
        ? { ...target.attributes, organizationUnitId: unit.id }
        : { ...target.attributes, scopeId: unit.id }
    expect(
      await repository.write(command([{ ...target, revision: 2, attributes: falseId }], 1)),
    ).toMatchObject({ kind: "invalid" })
    expect(await counts(database)).toEqual(before)
    expect(
      await repository.write(command([{ ...continuation, revision: 2, state: "void" }], 1)),
    ).toMatchObject({ kind: "invalid" })
    expect(await counts(database)).toEqual(before)
  },
)

async function counts(database: D1Database) {
  return database
    .prepare(`
    SELECT
      (SELECT count(*) FROM company_resource_heads) AS heads,
      (SELECT count(*) FROM company_resource_revisions) AS revisions,
      (SELECT count(*) FROM company_command_receipts) AS receipts,
      (SELECT coalesce(sum(revision), 0) FROM company_organizations) AS organization_revision
  `)
    .first()
}

describe("Company workforce resourceの参照整合性", () => {
  test("同一batchの業務payloadが異なる再送を拒否する", async () => {
    const { database } = await fixture()
    await execSql(database, "CREATE TABLE care_test_updates (value TEXT NOT NULL)")
    const change = command([employment, employee, person])
    const repository = (value: string, atomicPayload: unknown = { value }) =>
      new D1CompanyResourceRepository({
        database,
        atomicStatements: [
          database.prepare("INSERT INTO care_test_updates (value) VALUES (?1)").bind(value),
        ],
        atomicPayload,
      })

    expect(await repository("initial").write(change)).toMatchObject({
      kind: "applied",
      replayed: false,
    })
    expect(await repository("initial").write(change)).toMatchObject({
      kind: "applied",
      replayed: true,
    })
    expect(await repository("changed").write(change)).toEqual({ kind: "command_conflict" })
    expect((await database.prepare("SELECT value FROM care_test_updates").all()).results).toEqual([
      { value: "initial" },
    ])
    expect((await counts(database))?.organization_revision).toBe(1)
  })

  test("同一batchの業務書込にpayloadがない場合は何も保存しない", async () => {
    const { database } = await fixture()
    await execSql(database, "CREATE TABLE care_test_updates (value TEXT NOT NULL)")
    const repository = new D1CompanyResourceRepository({
      database,
      atomicStatements: [database.prepare("INSERT INTO care_test_updates VALUES ('unexpected')")],
    })
    expect(await repository.write(command([employment, employee, person]))).toMatchObject({
      kind: "unavailable",
    })
    expect((await database.prepare("SELECT value FROM care_test_updates").all()).results).toEqual(
      [],
    )
    expect(await counts(database)).toEqual({
      heads: 0,
      revisions: 0,
      receipts: 0,
      organization_revision: 0,
    })
  })

  test("同一batchの業務書込に失敗したらCompany履歴も再送記録も残さない", async () => {
    const { database } = await fixture()
    await execSql(
      database,
      "CREATE TABLE care_test_updates (value TEXT NOT NULL CHECK (value = 'valid'))",
    )
    const repository = new D1CompanyResourceRepository({
      database,
      atomicStatements: [database.prepare("INSERT INTO care_test_updates VALUES ('invalid')")],
      atomicPayload: { value: "invalid" },
    })
    expect(await repository.write(command([employment, employee, person]))).toMatchObject({
      kind: "unavailable",
    })
    expect((await database.prepare("SELECT value FROM care_test_updates").all()).results).toEqual(
      [],
    )
    expect(await counts(database)).toEqual({
      heads: 0,
      revisions: 0,
      receipts: 0,
      organization_revision: 0,
    })
  })

  test("参照順と逆に入力しても人・従業員・雇用を原子的に登録し、再送で増やさない", async () => {
    const { database, repository } = await fixture()
    const change = command([employment, employee, person])
    expect(await repository.write(change)).toEqual({
      kind: "applied",
      organizationRevision: 1,
      replayed: false,
    })
    expect(await repository.write(change)).toEqual({
      kind: "applied",
      organizationRevision: 1,
      replayed: true,
    })
    expect(await counts(database)).toEqual({
      heads: 3,
      revisions: 3,
      receipts: 1,
      organization_revision: 1,
    })
  })

  test.each([employee, employment])(
    "$typeの参照先がなければreceiptも組織revisionも残さない",
    async (resource) => {
      const { database, repository } = await fixture()
      expect(await repository.write(command([resource]))).toMatchObject({
        kind: "invalid",
        error: { code: "invalid_resource" },
      })
      expect(await counts(database)).toEqual({
        heads: 0,
        revisions: 0,
        receipts: 0,
        organization_revision: 0,
      })
    },
  )

  test("同じIDが別organizationにあっても参照できない", async () => {
    const { repository } = await fixture()
    expect(
      await repository.write(
        command([{ ...person, organizationId: "01900060-0000-7000-8000-12268fccf2cc" }]),
      ),
    ).toMatchObject({ kind: "applied" })
    expect(await repository.write(command([employee]))).toMatchObject({ kind: "invalid" })
  })

  test("別organizationの従業員を単一Companyの業務台帳へ混在させない", async () => {
    const { database, repository } = await fixture()
    expect(
      await repository.write(
        command([
          { ...person, organizationId: "01900060-0000-7000-8000-12268fccf2cc" },
          { ...employee, organizationId: "01900060-0000-7000-8000-12268fccf2cc" },
          { ...employment, organizationId: "01900060-0000-7000-8000-12268fccf2cc" },
        ]),
      ),
    ).toMatchObject({ kind: "invalid", error: { code: "invalid_resource" } })
    expect(await database.prepare("SELECT id FROM company_employees").first()).toBeNull()
    expect(await counts(database)).toEqual({
      heads: 0,
      revisions: 0,
      receipts: 0,
      organization_revision: 0,
    })
  })

  test("取消済みのPersonを新しいEmployeeから参照できない", async () => {
    const { repository } = await fixture()
    expect(await repository.write(command([person]))).toMatchObject({ kind: "applied" })
    expect(
      await repository.write(command([{ ...person, revision: 2, state: "void" }], 1)),
    ).toMatchObject({ kind: "applied" })
    expect(await repository.write(command([employee], 2))).toMatchObject({ kind: "invalid" })
  })

  test("後続resourceの失敗で先行resourceの更新も取り消す", async () => {
    const { database, repository } = await fixture()
    expect(await repository.write(command([person, employee, employment]))).toMatchObject({
      kind: "applied",
    })
    const before = await counts(database)
    expect(
      await repository.write(
        command(
          [
            { ...person, revision: 2, attributes: { officialName: "Changed Person" } },
            {
              ...employment,
              revision: 2,
              attributes: {
                employeeId: "a5438ed0-be24-4fee-afe4-037ae70145b7",
                status: "ACTIVE",
                employmentType: "FULL_TIME",
              },
            },
          ],
          1,
        ),
      ),
    ).toMatchObject({ kind: "invalid" })
    expect(await counts(database)).toEqual(before)
    const result = await repository.findMany({
      organizationId: person.organizationId,
      types: ["person"],
    })
    if (!result.ok) throw result.cause
    expect(result.resources[0]?.readText("officialName")).toBe("Example Person")
  })

  test.each(["active", "void"] as const)(
    "EmployeeとEmploymentの持ち主は%sへの変更でも付け替えられない",
    async (state) => {
      const { database, repository } = await fixture()
      const otherPerson = { ...person, id: "person:2" }
      const otherEmployee = {
        ...employee,
        id: "86cf8dfa-151f-424b-ae22-fa25a715308d",
        attributes: { personId: otherPerson.id },
      }
      expect(
        await repository.write(command([person, otherPerson, employee, otherEmployee, employment])),
      ).toMatchObject({ kind: "applied" })
      const before = await counts(database)
      expect(
        await repository.write(
          command(
            [
              {
                ...employee,
                revision: 2,
                state,
                attributes: { personId: otherPerson.id },
              },
            ],
            1,
          ),
        ),
      ).toMatchObject({ kind: "invalid" })
      expect(
        await repository.write(
          command(
            [
              {
                ...employment,
                revision: 2,
                state,
                attributes: {
                  employeeId: otherEmployee.id,
                  status: "ACTIVE",
                  employmentType: "FULL_TIME",
                },
              },
            ],
            1,
          ),
        ),
      ).toMatchObject({ kind: "invalid" })
      expect(await counts(database)).toEqual(before)
    },
  )

  test.each([person, employee, employment])(
    "参照されている$typeの取消で履歴とrevisionを変えない",
    async (resource) => {
      const { database, repository } = await fixture()
      expect(
        await repository.write(
          command([person, employee, employment, organizationUnit, assignment]),
        ),
      ).toMatchObject({ kind: "applied" })
      const before = await counts(database)
      expect(
        await repository.write(command([{ ...resource, revision: 2, state: "void" }], 1)),
      ).toMatchObject({ kind: "invalid" })
      expect(await counts(database)).toEqual(before)
    },
  )

  test("参照する側も同一commandで取り消せば全体を取り消せる", async () => {
    const { database, repository } = await fixture()
    const resources = [person, employee, employment, assignment]
    expect(await repository.write(command([...resources, organizationUnit]))).toMatchObject({
      kind: "applied",
    })
    expect(
      await repository.write(
        command(
          resources.map((resource) => ({
            ...resource,
            revision: 2,
            state: "void",
          })),
          1,
        ),
      ),
    ).toMatchObject({ kind: "applied", organizationRevision: 2 })
    expect(
      await database
        .prepare(
          "SELECT count(*) AS count FROM company_resource_heads WHERE state = 'active' AND resource_type <> 'organization-unit'",
        )
        .first<{ count: number }>(),
    ).toEqual({ count: 0 })
    expect(await counts(database)).toEqual({
      heads: 5,
      revisions: 9,
      receipts: 2,
      organization_revision: 2,
    })
  })

  test.each(["assignment", "office-assignment", "organizational-authority"] as const)(
    "他人の雇用を$typeへ割り当てられない",
    async (type) => {
      const { repository } = await fixture()
      const otherEmployee = {
        ...employee,
        id: "86cf8dfa-151f-424b-ae22-fa25a715308d",
        attributes: { personId: person.id, employeeCode: "E002" },
      }
      const unit: CompanyResourceProps = {
        ...person,
        type: "organization-unit",
        id: "0190005f-0000-7000-8000-2fcb85764fe2",
        attributes: {
          organizationUnitId: "0190005f-0000-7000-8000-2fcb85764fe2",
          code: "ROOT",
          officialName: "Example Organization",
          kind: "COMPANY",
          parentOrganizationUnitId: null,
        },
      }
      const position: CompanyResourceProps = {
        ...person,
        type: "position",
        id: "position:1",
        attributes: { code: "MANAGER", officialName: "Manager" },
      }
      const office: CompanyResourceProps = {
        ...person,
        type: "organizational-office",
        id: "office:1",
        attributes: {
          code: "ROOT_MANAGER",
          officialName: "Organization Manager",
          organizationUnitId: unit.id,
          positionId: position.id,
        },
      }
      expect(
        await repository.write(
          command([
            person,
            employee,
            otherEmployee,
            employment,
            unit,
            position,
            office,
            ...(type === "organizational-authority"
              ? [{ ...assignment, id: "74630569-1c55-45c1-a16f-7e1d955fc37c" }]
              : []),
          ]),
        ),
      ).toMatchObject({ kind: "applied" })
      const attributes: CompanyResourceProps["attributes"] =
        type === "assignment"
          ? { ...assignment.attributes, employeeId: otherEmployee.id }
          : type === "office-assignment"
            ? {
                employeeId: otherEmployee.id,
                employmentId: employment.id,
                organizationalOfficeId: "office:1",
              }
            : {
                employeeId: otherEmployee.id,
                employmentId: employment.id,
                scopeType: "organization-unit",
                scopeId: "0190005f-0000-7000-8000-2fcb85764fe2",
                authority: "approve",
              }
      expect(
        await repository.write(
          command(
            [{ ...assignment, type, attributes: { ...attributes, employeeId: employee.id } }],
            1,
          ),
        ),
      ).toMatchObject({ kind: "applied" })
      expect(
        await repository.write(command([{ ...assignment, type, revision: 2, attributes }], 2)),
      ).toMatchObject({ kind: "invalid" })
    },
  )

  test("上司として参照されているEmployeeは取り消せない", async () => {
    const { repository } = await fixture()
    const manager = {
      ...employee,
      id: "3b4998e1-9d0a-4f19-9ade-044faa2d8620",
      attributes: { personId: person.id, employeeCode: "E003" },
    }
    const reporting: CompanyResourceProps = {
      ...person,
      id: "reporting:1",
      type: "reporting-relation",
      attributes: {
        employeeId: employee.id,
        managerEmployeeId: manager.id,
        organizationUnitId: "0190005f-0000-7000-8000-2fcb85764fe2",
      },
    }
    const managerEmployment = {
      ...employment,
      id: "ae3a296c-d93a-4ca2-983e-03faf5da61e5",
      attributes: { ...employment.attributes, employeeId: manager.id },
    }
    expect(
      await repository.write(
        command([
          person,
          employee,
          manager,
          employment,
          managerEmployment,
          organizationUnit,
          reporting,
        ]),
      ),
    ).toMatchObject({
      kind: "applied",
    })
    expect(
      await repository.write(command([{ ...manager, revision: 2, state: "void" }], 1)),
    ).toMatchObject({ kind: "invalid" })
  })

  test("Account対応が残るEmployeeは雇用がなくても取り消せない", async () => {
    const { database, repository } = await fixture()
    await database
      .prepare(
        "INSERT INTO system_accounts (id, status, token_version, created_at, updated_at) VALUES ('c0975461-26d2-43a1-86d2-124bd000d9c9', 'active', 0, 0, 0)",
      )
      .run()
    const link: CompanyResourceProps = {
      ...person,
      id: "29851eda-2a1b-4d95-964e-d5115f5bf377",
      type: "account-employee-link",
      attributes: { employeeId: employee.id, accountId: "c0975461-26d2-43a1-86d2-124bd000d9c9" },
    }
    expect(await repository.write(command([person, employee, link]))).toMatchObject({
      kind: "applied",
    })
    expect(
      await repository.write(command([{ ...employee, revision: 2, state: "void" }], 1)),
    ).toMatchObject({ kind: "invalid" })
  })

  test("競合と保存障害を参照不整合へ分類しない", async () => {
    const { database, repository } = await fixture()
    expect(await repository.write(command([person]))).toMatchObject({ kind: "applied" })
    expect(await repository.write(command([employee], 0, "command:stale"))).toMatchObject({
      kind: "conflict",
      actualRevision: 1,
    })
    expect(await repository.write(command([person], 1))).toMatchObject({
      kind: "resource_conflict",
      actualRevision: 1,
    })
    expect(await repository.write(command([employee], 0))).toEqual({ kind: "command_conflict" })
    await execSql(
      database,
      "CREATE TRIGGER reject_company_write BEFORE INSERT ON company_resource_revisions BEGIN SELECT RAISE(ABORT, 'storage_failure'); END;",
    )
    expect(await repository.write(command([employee], 1))).toMatchObject({ kind: "unavailable" })
  })

  test("同じrevisionへの同時登録は一方だけが確定する", async () => {
    const { database, repository } = await fixture()
    expect(await repository.write(command([person]))).toMatchObject({ kind: "applied" })
    const results = await Promise.all([
      repository.write(command([employee], 1, "command:first")),
      repository.write(
        command([{ ...employee, id: "86cf8dfa-151f-424b-ae22-fa25a715308d" }], 1, "command:second"),
      ),
    ])
    expect(results.filter((result) => result.kind === "applied")).toHaveLength(1)
    expect(results.filter((result) => result.kind === "conflict")).toHaveLength(1)
    expect(await counts(database)).toEqual({
      heads: 2,
      revisions: 2,
      receipts: 2,
      organization_revision: 2,
    })
  })
})

test.each([false, true])(
  "100件のIDを時点指定=%sで照会してもD1のbind上限を超えない",
  async (dated) => {
    const f = await fixture()
    const records: CompanyResourceProps[] = Array.from({ length: 100 }, (_, index) => ({
      ...person,
      id: `person:bulk:${String(index).padStart(3, "0")}`,
      attributes: { officialName: `Person ${index}` },
    }))
    expect(await f.repository.write(command(records))).toMatchObject({ kind: "applied" })
    expect(
      await f.repository.write(command([{ ...person, id: "person:excluded" }], 1)),
    ).toMatchObject({ kind: "applied" })
    const prepare = f.database.prepare.bind(f.database)
    f.database.prepare = (query) => {
      const statement = prepare(query)
      const bind = statement.bind.bind(statement)
      statement.bind = (...values: unknown[]) => {
        if (values.length > 100) throw new Error(`D1 bind limit exceeded: ${values.length}`)
        return bind(...values)
      }
      return statement
    }
    const result = await f.repository.findMany({
      organizationId: person.organizationId,
      types: ["person"],
      ids: records.map((record) => record.id),
      ...(dated ? { effectiveOn: effectiveFrom } : {}),
    })
    expect(result.ok).toBe(true)
    if (!result.ok) throw result.cause
    expect(result.organizationRevision).toBe(2)
    expect(result.resources.map((resource) => resource.id)).toEqual(
      records.map((record) => record.id),
    )
  },
)

test("IDの引用符とバックスラッシュを照会条件として保持する", async () => {
  const f = await fixture()
  const quoted = { ...person, id: `person:"quoted"\\suffix` }
  expect(await f.repository.write(command([person, quoted]))).toMatchObject({ kind: "applied" })
  const result = await f.repository.findMany({
    organizationId: person.organizationId,
    types: ["person"],
    ids: [quoted.id],
    effectiveOn: effectiveFrom,
  })
  expect(result.ok).toBe(true)
  if (!result.ok) throw result.cause
  expect(result.resources.map((resource) => resource.id)).toEqual([quoted.id])
})
