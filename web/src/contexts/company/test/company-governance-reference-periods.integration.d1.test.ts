import { testDerivedId } from "@system/test/system-test-id.test-support"
import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { splitSqlStatements } from "@/lib/database/split-sql-statements"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const schema =
  readFileSync(
    new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
    "utf8",
  ) +
  "\n" +
  readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8")
const common = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  revision: 1,
  state: "active" as const,
  effectiveFrom: restoreCalendarDate("2030-01-01"),
  effectiveTo: null,
}
const responsibility: CompanyResourceProps = {
  ...common,
  type: "responsibility",
  id: "responsibility:review",
  attributes: { code: "REVIEW", officialName: "Review" },
}
const body: CompanyResourceProps = {
  ...common,
  type: "collective-body",
  id: "body:review",
  attributes: {
    code: "REVIEW",
    officialName: "Review committee",
    quorumType: "count",
    quorumValue: 1,
    decisionRule: "unanimity",
  },
}
const assignment: CompanyResourceProps = {
  ...common,
  type: "responsibility-assignment",
  id: "assignment:review",
  attributes: {
    responsibilityId: responsibility.id,
    holderType: "collective-body",
    holderId: body.id,
    authorityScopeId: null,
    delegationAllowed: false,
  },
}
const job: CompanyResourceProps = {
  ...common,
  type: "job",
  id: "job:review",
  attributes: { code: "REVIEW", officialName: "Review" },
}
const position: CompanyResourceProps = {
  ...common,
  type: "position",
  id: "position:review",
  attributes: { code: "REVIEW", officialName: "Reviewer", jobId: job.id },
}
const unit: CompanyResourceProps = {
  ...common,
  type: "organization-unit",
  id: "0190005f-0000-7000-8000-0e0100000001",
  attributes: {
    organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
    code: "ROOT",
    officialName: "Company",
    kind: "COMPANY",
    parentOrganizationUnitId: null,
  },
}
const office: CompanyResourceProps = {
  ...common,
  type: "organizational-office",
  id: "office:review",
  attributes: {
    code: "REVIEW",
    officialName: "Reviewer",
    positionId: position.id,
    organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
  },
}
const scope: CompanyResourceProps = {
  ...common,
  type: "authority-scope",
  id: "scope:review",
  attributes: { scopeType: "region", regionCode: "REGION" },
}
const legalEntity: CompanyResourceProps = {
  ...common,
  type: "legal-entity",
  id: "legal:company",
  attributes: {
    officialName: "Example Company",
    jurisdictionCountryCode: "JP",
    registrationNumber: null,
    defaultCurrencyCode: "JPY",
  },
}
const site: CompanyResourceProps = {
  ...common,
  type: "site",
  id: "site:office",
  attributes: {
    code: "OFFICE",
    officialName: "Office",
    legalEntityId: legalEntity.id,
    kind: "physical",
    timeZone: "UTC",
    countryCode: "JP",
  },
}
const workplace: CompanyResourceProps = {
  ...common,
  type: "workplace",
  id: "workplace:office",
  attributes: {
    code: "OFFICE",
    officialName: "Office",
    siteId: site.id,
    kind: "office",
  },
}
const person: CompanyResourceProps = {
  ...common,
  type: "person",
  id: "person:member",
  attributes: { officialName: "Member" },
}
const employee: CompanyResourceProps = {
  ...common,
  type: "employee",
  id: testDerivedId("employee", "member"),
  attributes: { personId: person.id },
}
const employment: CompanyResourceProps = {
  ...common,
  type: "employment",
  id: testDerivedId("employment", "member"),
  attributes: {
    employeeId: employee.id,
    status: "ACTIVE",
    employmentType: "FULL_TIME",
  },
}
const references: ReadonlyArray<
  Readonly<{
    name: string
    target: CompanyResourceProps
    dependent: CompanyResourceProps
    prerequisites: ReadonlyArray<CompanyResourceProps>
  }>
> = [
  { name: "職位から職務", target: job, dependent: position, prerequisites: [] },
  { name: "組織役職から職位", target: position, dependent: office, prerequisites: [unit, job] },
  {
    name: "責務から保持する役職",
    target: office,
    dependent: {
      ...assignment,
      attributes: {
        ...assignment.attributes,
        holderType: "organizational-office",
        holderId: office.id,
      },
    },
    prerequisites: [unit, job, position, responsibility],
  },
  {
    name: "責務から対象範囲",
    target: scope,
    dependent: {
      ...assignment,
      attributes: {
        ...assignment.attributes,
        authorityScopeId: scope.id,
      },
    },
    prerequisites: [responsibility, body],
  },
  {
    name: "任用から組織役職",
    target: office,
    dependent: {
      ...common,
      type: "office-assignment",
      id: "appointment:member",
      attributes: {
        organizationalOfficeId: office.id,
        employeeId: employee.id,
        employmentId: employment.id,
      },
    },
    prerequisites: [unit, job, position, person, employee, employment],
  },
  {
    name: "構成員から合議体",
    target: body,
    dependent: {
      ...common,
      type: "collective-body-membership",
      id: "membership:member",
      attributes: {
        collectiveBodyId: body.id,
        employeeId: employee.id,
        role: "member",
        voting: true,
      },
    },
    prerequisites: [person, employee, employment],
  },
  {
    name: "決裁資格から対象範囲",
    target: scope,
    dependent: {
      ...common,
      type: "organizational-authority",
      id: "authority:member",
      attributes: {
        scopeType: "authority-scope",
        scopeId: scope.id,
        employeeId: employee.id,
        employmentId: employment.id,
        authority: "REVIEW",
      },
    },
    prerequisites: [
      unit,
      person,
      employee,
      employment,
      {
        ...common,
        type: "assignment",
        id: testDerivedId("assignment", "member"),
        attributes: {
          employeeId: employee.id,
          employmentId: employment.id,
          organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
          assignmentType: "PRIMARY",
        },
      },
    ],
  },
  ...[legalEntity, site, workplace].map((target) => ({
    name: `対象範囲から${target.type}`,
    target,
    dependent: { ...scope, attributes: { scopeType: target.type, scopeId: target.id } },
    prerequisites: [legalEntity, site, workplace].slice(
      0,
      [legalEntity, site, workplace].indexOf(target),
    ),
  })),
]

async function fixture(schemaSql = schema) {
  const database = await createLocalD1Database({ schema: schemaSql })
  const repository = new D1CompanyResourceRepository({ database })
  const write = async (
    resources: ReadonlyArray<CompanyResourceProps>,
    expectedRevision: number,
    commandId = `command:${expectedRevision}`,
  ) => {
    const command = CompanyResourceChangeEntity.create({
      resources,
      expectedRevision,
      commandId,
      actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      reason: "Confirm governance history",
      recordedAt: Date.parse("2030-06-01T00:00:00Z"),
    })
    if (command instanceof Error) throw command
    return repository.write(command)
  }
  const saved = () =>
    database
      .prepare(`SELECT
    (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}') AS revision,
    (SELECT count(*) FROM company_resource_revisions) AS resources,
    (SELECT count(*) FROM company_command_receipts) AS receipts`)
      .first()
  return { database, repository, write, saved }
}

test.each([responsibility, body])(
  "任用を期間外へ残す $type の短縮を拒否し、全変更を取り消す",
  async (definition) => {
    const f = await fixture()
    expect(await f.write([responsibility, body, assignment], 0)).toMatchObject({ kind: "applied" })
    const before = await f.saved()
    expect(
      await f.write(
        [{ ...definition, revision: 2, effectiveTo: restoreCalendarDate("2030-07-01") }],
        1,
      ),
    ).toMatchObject({ kind: "invalid" })
    expect(await f.saved()).toEqual(before)
  },
)

test.each([...references])(
  "$name の全期間を検査し、参照先の短縮と開始前の利用を拒否する",
  async (reference) => {
    const f = await fixture()
    expect(
      await f.write([...reference.prerequisites, reference.target, reference.dependent], 0),
    ).toMatchObject({ kind: "applied" })
    const before = await f.saved()
    expect(
      await f.write(
        [{ ...reference.target, revision: 2, effectiveTo: restoreCalendarDate("2030-07-01") }],
        1,
      ),
    ).toMatchObject({ kind: "invalid" })
    expect(await f.saved()).toEqual(before)
    const fresh = await fixture()
    expect(
      await fresh.write(
        [
          ...reference.prerequisites,
          { ...reference.target, effectiveFrom: restoreCalendarDate("2030-07-01") },
          reference.dependent,
        ],
        0,
      ),
    ).toMatchObject({ kind: "invalid" })
    expect(await fresh.saved()).toEqual({ revision: null, resources: 0, receipts: 0 })
  },
)

test("将来取消した任用の過去も保全し、定義と任用は同じcommandで終了できる", async () => {
  const f = await fixture()
  expect(await f.write([responsibility, body, assignment], 0)).toMatchObject({ kind: "applied" })
  const endsOn = restoreCalendarDate("2030-07-01")
  expect(
    await f.write([{ ...assignment, revision: 2, state: "void", effectiveFrom: endsOn }], 1),
  ).toMatchObject({ kind: "applied" })
  const before = await f.saved()
  expect(
    await f.write(
      [{ ...responsibility, revision: 2, effectiveTo: restoreCalendarDate("2030-06-01") }],
      2,
    ),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
  const resources = [
    { ...responsibility, revision: 2, state: "void" as const, effectiveFrom: endsOn },
    { ...body, revision: 2, state: "void" as const, effectiveFrom: endsOn },
  ]
  expect(await f.write(resources, 2)).toMatchObject({ kind: "applied", replayed: false })
  const saved = await f.saved()
  expect(await f.write(resources, 2)).toMatchObject({ kind: "applied", replayed: true })
  expect(await f.saved()).toEqual(saved)
  /** 未来の取消状態から過去の有効な定義を失わせず、過去の任用を訂正できる。 */
  expect(await f.write([{ ...assignment, revision: 3, effectiveTo: endsOn }], 3)).toMatchObject({
    kind: "applied",
  })
  for (const date of ["2030-06-30", "2030-07-01"]) {
    const read = await f.repository.findMany({
      organizationId: common.organizationId,
      types: ["responsibility", "collective-body", "responsibility-assignment"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!read.ok) throw read.cause
    expect(read.resources).toHaveLength(date === "2030-06-30" ? 3 : 0)
  }
})

test("連続する定義の版をまたぐ任用を許可し、訂正で開く空白と別組織の定義を拒否する", async () => {
  const f = await fixture()
  const boundary = restoreCalendarDate("2030-07-01")
  expect(await f.write([{ ...responsibility, effectiveTo: boundary }, body], 0)).toMatchObject({
    kind: "applied",
  })
  expect(
    await f.write([{ ...responsibility, revision: 2, effectiveFrom: boundary }], 1),
  ).toMatchObject({ kind: "applied" })
  expect(await f.write([assignment], 2)).toMatchObject({ kind: "applied" })
  const before = await f.saved()
  expect(
    await f.write(
      [{ ...responsibility, revision: 3, effectiveTo: restoreCalendarDate("2030-06-01") }],
      3,
    ),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
  expect(
    await f.write(
      [{ ...responsibility, organizationId: "01900060-0000-7000-8000-12268fccf2cc" }],
      0,
      "other-definition",
    ),
  ).toMatchObject({ kind: "applied" })
  const beforeRejected = await f.saved()
  expect(
    await f.write(
      [
        { ...body, organizationId: "01900060-0000-7000-8000-31c6b0da6645" },
        { ...assignment, organizationId: "01900060-0000-7000-8000-31c6b0da6645" },
      ],
      0,
      "other-assignment",
    ),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(beforeRejected)
})

test("任用と定義の同時短縮は入力順に依存せず、保存済みの過去を維持する", async () => {
  const f = await fixture()
  expect(await f.write([responsibility, body, assignment], 0)).toMatchObject({ kind: "applied" })
  const ended = [responsibility, body, assignment].map((resource) => ({
    ...resource,
    revision: 2,
    effectiveTo: restoreCalendarDate("2030-07-01"),
  }))
  expect(await f.write(ended, 1)).toMatchObject({ kind: "applied" })
  const saved = await f.saved()
  expect(await f.write([{ ...responsibility, revision: 2 }], 1, "stale-shortening")).toMatchObject({
    kind: "conflict",
  })
  expect(await f.saved()).toEqual(saved)
})

test("既存の期間不整合ではmigrationが停止し、制約と履歴を保全する", async () => {
  const marker = "CREATE VIEW company_governance_resource_periods AS"
  const start = schema.indexOf(marker)
  expect(start).toBeGreaterThan(0)
  const f = await fixture(schema.slice(0, start))
  const database = f.database
  expect(
    await f.write(
      [{ ...responsibility, effectiveTo: restoreCalendarDate("2030-07-01") }, body, assignment],
      0,
    ),
  ).toMatchObject({ kind: "applied" })
  const history = (
    await database.prepare("SELECT * FROM company_resource_revisions ORDER BY resource_type").all()
  ).results
  const attempted = await database
    .batch(splitSqlStatements(schema.slice(start)).map((sql) => database.prepare(sql)))
    .catch((cause: unknown) => cause)
  expect(attempted).toBeInstanceOf(Error)
  if (!(attempted instanceof Error)) throw new Error("Invalid governance history was accepted")
  expect(attempted.message).toContain("company_governance_reference_period_not_covered")
  expect(
    (
      await database
        .prepare("SELECT * FROM company_resource_revisions ORDER BY resource_type")
        .all()
    ).results,
  ).toEqual(history)
  expect(
    await database
      .prepare(
        "SELECT name FROM sqlite_master WHERE name = 'company_governance_definition_void_guard'",
      )
      .first(),
  ).not.toBeNull()
  expect(
    await database
      .prepare("SELECT name FROM sqlite_master WHERE name = 'company_governance_resource_periods'")
      .first(),
  ).toBeNull()
})
