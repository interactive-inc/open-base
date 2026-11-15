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

/**
 * 役職の任用と合議体の構成員は、任期の重なりで重複を判定する。終了日を付けた前任の行も
 * 履歴として active のまま残るので、期間を見ない一意索引では任期の重ならない交代や再任を保存できない。
 *
 * ここでは業務検査を通さない `write` で保存し、DB の境界だけで「重ならない交代・再任は保存でき、
 * 1 日でも重なれば同じ batch の中でも全体を取り消す」ことを固定する。
 */

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
const job: CompanyResourceProps = {
  ...common,
  type: "job",
  id: "job:chair",
  attributes: { code: "CHAIR", officialName: "Chair" },
}
const position: CompanyResourceProps = {
  ...common,
  type: "position",
  id: "position:chair",
  attributes: { code: "CHAIR", officialName: "Chair", jobId: job.id },
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
  id: "office:chair",
  attributes: {
    code: "CHAIR",
    officialName: "Chair",
    positionId: position.id,
    organizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
  },
}
const body: CompanyResourceProps = {
  ...common,
  type: "collective-body",
  id: "body:board",
  attributes: {
    code: "BOARD",
    officialName: "Board",
    quorumType: "count",
    quorumValue: 1,
    decisionRule: "unanimity",
  },
}

function staff(name: string): ReadonlyArray<CompanyResourceProps> {
  const person: CompanyResourceProps = {
    ...common,
    type: "person",
    id: `person:${name}`,
    attributes: { officialName: name },
  }
  const employee: CompanyResourceProps = {
    ...common,
    type: "employee",
    id: testDerivedId("employee", name),
    attributes: { personId: person.id },
  }
  const employment: CompanyResourceProps = {
    ...common,
    type: "employment",
    id: testDerivedId("employment", name),
    attributes: { employeeId: employee.id, status: "ACTIVE", employmentType: "FULL_TIME" },
  }

  return [person, employee, employment]
}

function appointment(
  id: string,
  name: string,
  period: Readonly<{ from?: string; to?: string | null; revision?: number }> = {},
): CompanyResourceProps {
  return {
    ...common,
    type: "office-assignment",
    id,
    revision: period.revision ?? 1,
    effectiveFrom: restoreCalendarDate(period.from ?? "2030-01-01"),
    effectiveTo: period.to == null ? null : restoreCalendarDate(period.to),
    attributes: {
      organizationalOfficeId: office.id,
      employeeId: testDerivedId("employee", name),
      employmentId: testDerivedId("employment", name),
    },
  }
}

function membership(
  id: string,
  period: Readonly<{ from?: string; to?: string | null; revision?: number }> = {},
): CompanyResourceProps {
  return {
    ...common,
    type: "collective-body-membership",
    id,
    revision: period.revision ?? 1,
    effectiveFrom: restoreCalendarDate(period.from ?? "2030-01-01"),
    effectiveTo: period.to == null ? null : restoreCalendarDate(period.to),
    attributes: {
      collectiveBodyId: body.id,
      employeeId: testDerivedId("employee", "member"),
      role: "member",
      voting: true,
    },
  }
}

const officePrerequisites = [unit, job, position, office, ...staff("former"), ...staff("successor")]
const bodyPrerequisites = [body, ...staff("member")]

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
      reason: "Record tenure history",
      recordedAt: Date.parse("2030-06-01T00:00:00Z"),
    })
    if (command instanceof Error) throw command
    return repository.write(command)
  }
  // 訂正は、訂正する版の番号を添えて同じ資源の新しい版を足す。取消の版と新しい開始日の版を
  // 一度に足す形は履歴の一括保存として扱う。
  const correct = async (
    resources: ReadonlyArray<CompanyResourceProps>,
    correctsRevision: number,
    expectedRevision: number,
  ) => {
    const props = {
      resources,
      expectedRevision,
      commandId: `correction:${expectedRevision}`,
      actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      reason: "Correct tenure start",
      recordedAt: Date.parse("2030-06-01T00:00:00Z"),
      evidenceReferences: [
        { context: "system", kind: "document", id: `tenure:${expectedRevision}`, version: "1" },
      ],
      corrections: resources.map((resource) => ({
        type: resource.type,
        id: resource.id,
        revision: resource.revision,
        correctsRevision,
      })),
    }
    const command =
      resources.length > 1
        ? CompanyResourceChangeEntity.createHistoryBatch(props)
        : CompanyResourceChangeEntity.create(props)
    if (command instanceof Error) throw command
    return repository.write(command)
  }
  const saved = () =>
    database
      .prepare(`SELECT
    (SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}') AS revision,
    (SELECT count(*) FROM company_resource_revisions) AS resources,
    (SELECT count(*) FROM company_resource_heads) AS heads,
    (SELECT count(*) FROM company_command_receipts) AS receipts`)
      .first()
  const holdersOn = async (date: string) => {
    const read = await repository.findMany({
      organizationId: common.organizationId,
      types: ["office-assignment"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!read.ok) throw read.cause
    return read.resources.map((resource) => resource.id)
  }
  return { database, repository, write, correct, saved, holdersOn }
}

test("前任の終了日に後任が始まる交代を別の任用として保存し、時点ごとに在任者を引ける", async () => {
  const f = await fixture()
  expect(
    await f.write(
      [...officePrerequisites, appointment("appointment:former", "former", { to: "2030-07-01" })],
      0,
    ),
  ).toMatchObject({ kind: "applied" })

  expect(
    await f.write([appointment("appointment:successor", "successor", { from: "2030-07-01" })], 1),
  ).toMatchObject({ kind: "applied" })

  expect(await f.holdersOn("2030-06-30")).toEqual(["appointment:former"])
  expect(await f.holdersOn("2030-07-01")).toEqual(["appointment:successor"])
  expect(await f.holdersOn("2031-01-01")).toEqual(["appointment:successor"])
})

test("間の空く交代と、前任の終了と後任の開始を同じ変更で記録する交代を保存する", async () => {
  const gap = await fixture()
  expect(
    await gap.write(
      [...officePrerequisites, appointment("appointment:former", "former", { to: "2030-07-01" })],
      0,
    ),
  ).toMatchObject({ kind: "applied" })
  expect(
    await gap.write([appointment("appointment:successor", "successor", { from: "2030-09-01" })], 1),
  ).toMatchObject({ kind: "applied" })
  expect(await gap.holdersOn("2030-08-01")).toEqual([])

  const sameBatch = await fixture()
  expect(
    await sameBatch.write([...officePrerequisites, appointment("appointment:former", "former")], 0),
  ).toMatchObject({ kind: "applied" })
  expect(
    await sameBatch.write(
      [
        appointment("appointment:successor", "successor", { from: "2030-07-01" }),
        appointment("appointment:former", "former", { to: "2030-07-01", revision: 2 }),
      ],
      1,
    ),
  ).toMatchObject({ kind: "applied" })
  expect(await sameBatch.holdersOn("2030-06-30")).toEqual(["appointment:former"])
  expect(await sameBatch.holdersOn("2030-07-01")).toEqual(["appointment:successor"])
})

test("1 日でも重なる任用は、別の変更でも同じ変更の中でも全体を取り消す", async () => {
  const f = await fixture()
  expect(
    await f.write(
      [...officePrerequisites, appointment("appointment:former", "former", { to: "2030-07-01" })],
      0,
    ),
  ).toMatchObject({ kind: "applied" })
  const before = await f.saved()

  expect(
    await f.write([appointment("appointment:successor", "successor", { from: "2030-06-30" })], 1),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)

  const sameBatch = await fixture()
  expect(
    await sameBatch.write(
      [
        ...officePrerequisites,
        appointment("appointment:former", "former"),
        appointment("appointment:successor", "successor", { from: "2030-07-01" }),
      ],
      0,
    ),
  ).toMatchObject({ kind: "invalid" })
  expect(await sameBatch.saved()).toEqual({ revision: null, resources: 0, heads: 0, receipts: 0 })
})

test("交代の後に前任の終了日を後ろへ訂正して重ねることは拒否し、後任の取消しの後なら認める", async () => {
  const f = await fixture()
  expect(
    await f.write(
      [
        ...officePrerequisites,
        appointment("appointment:former", "former", { to: "2030-07-01" }),
        appointment("appointment:successor", "successor", { from: "2030-07-01" }),
      ],
      0,
    ),
  ).toMatchObject({ kind: "applied" })
  const before = await f.saved()

  expect(
    await f.write(
      [appointment("appointment:former", "former", { to: "2030-08-01", revision: 2 })],
      1,
    ),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)

  expect(
    await f.write(
      [
        {
          ...appointment("appointment:successor", "successor", { from: "2030-07-01" }),
          revision: 2,
          state: "void",
        },
      ],
      1,
    ),
  ).toMatchObject({ kind: "applied" })
  expect(
    await f.write(
      [appointment("appointment:former", "former", { to: "2030-08-01", revision: 2 })],
      2,
    ),
  ).toMatchObject({ kind: "applied" })
  expect(await f.holdersOn("2030-07-15")).toEqual(["appointment:former"])
})

test("後任の開始日を後ろへ訂正した後は、訂正前の開始日で前任と重なるとは見なさない", async () => {
  const f = await fixture()
  expect(
    await f.write(
      [
        ...officePrerequisites,
        appointment("appointment:former", "former", { to: "2030-07-01" }),
        appointment("appointment:successor", "successor", { from: "2030-07-01" }),
      ],
      0,
    ),
  ).toMatchObject({ kind: "applied" })
  expect(
    await f.correct(
      [appointment("appointment:successor", "successor", { from: "2030-08-01", revision: 2 })],
      1,
      1,
    ),
  ).toMatchObject({ kind: "applied" })

  // 訂正前の 7 月 1 日開始の版が残っていると、前任を 8 月 1 日まで延ばす変更が重なりとして止まる。
  expect(
    await f.write(
      [appointment("appointment:former", "former", { to: "2030-08-01", revision: 2 })],
      2,
    ),
  ).toMatchObject({ kind: "applied" })
  expect(await f.holdersOn("2030-07-15")).toEqual(["appointment:former"])
  expect(await f.holdersOn("2030-08-01")).toEqual(["appointment:successor"])
  const before = await f.saved()

  // 訂正をさらに訂正して開始日を前任の任期の中へ戻すと、本当に重なるので拒む。
  expect(
    await f.correct(
      [appointment("appointment:successor", "successor", { from: "2030-07-15", revision: 3 })],
      2,
      3,
    ),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
})

test("同じ合議体へ別の構成員 ID で再任でき、任期の重なる構成員は拒否する", async () => {
  const f = await fixture()
  expect(
    await f.write([...bodyPrerequisites, membership("membership:first", { to: "2030-07-01" })], 0),
  ).toMatchObject({ kind: "applied" })

  expect(await f.write([membership("membership:second", { from: "2030-07-01" })], 1)).toMatchObject(
    { kind: "applied" },
  )
  const before = await f.saved()

  expect(
    await f.write([membership("membership:overlap", { from: "2030-06-30", to: "2030-07-02" })], 2),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)

  const sameBatch = await fixture()
  expect(
    await sameBatch.write(
      [
        ...bodyPrerequisites,
        membership("membership:first"),
        membership("membership:second", { from: "2031-01-01" }),
      ],
      0,
    ),
  ).toMatchObject({ kind: "invalid" })
  expect(await sameBatch.saved()).toEqual({ revision: null, resources: 0, heads: 0, receipts: 0 })
})

test("既存の履歴に任期の重なりがあれば、制約の付け替えを止めて一意索引と履歴を残す", async () => {
  const marker = "CREATE VIEW company_office_tenure_overlaps AS"
  const start = schema.indexOf(marker)
  expect(start).toBeGreaterThan(0)
  const f = await fixture(schema.slice(0, start))
  expect(
    await f.write([...officePrerequisites, appointment("appointment:former", "former")], 0),
  ).toMatchObject({ kind: "applied" })
  // 前任を将来の日付で取り消すと先頭の行は void になり、一意索引の対象から外れる。
  // 履歴には 2030-07-01 まで在任した版が残るので、6 月から始まる後任と期間が重なる。
  expect(
    await f.write(
      [
        {
          ...appointment("appointment:former", "former", { from: "2030-07-01", revision: 2 }),
          state: "void",
        },
      ],
      1,
    ),
  ).toMatchObject({ kind: "applied" })
  expect(
    await f.write([appointment("appointment:successor", "successor", { from: "2030-06-01" })], 2),
  ).toMatchObject({ kind: "applied" })
  const history = (
    await f.database
      .prepare("SELECT * FROM company_resource_revisions ORDER BY resource_type, resource_id")
      .all()
  ).results

  const attempted = await f.database
    .batch(splitSqlStatements(schema.slice(start)).map((sql) => f.database.prepare(sql)))
    .catch((cause: unknown) => cause)

  expect(attempted).toBeInstanceOf(Error)
  if (!(attempted instanceof Error)) throw new Error("Overlapping tenure history was accepted")
  expect(attempted.message).toContain("company_office_tenure_overlap")
  expect(
    (
      await f.database
        .prepare("SELECT * FROM company_resource_revisions ORDER BY resource_type, resource_id")
        .all()
    ).results,
  ).toEqual(history)
  for (const name of [
    "company_active_office_holder_uniq",
    "company_active_collective_body_member_uniq",
  ]) {
    expect(
      await f.database.prepare("SELECT name FROM sqlite_master WHERE name = ?1").bind(name).first(),
    ).not.toBeNull()
  }
})

test("訂正で開始日を動かした後任の履歴があっても制約を付け替え、その後の保存も止めない", async () => {
  const marker = "CREATE VIEW company_office_tenure_overlaps AS"
  const start = schema.indexOf(marker)
  for (const shape of ["single", "void-and-restart"] as const) {
    const f = await fixture(schema.slice(0, start))
    expect(
      await f.write([...officePrerequisites, appointment("appointment:former", "former")], 0),
    ).toMatchObject({ kind: "applied" })
    // 旧の制約では、前任を 7 月 1 日付で取り消して終了させ、後任を 6 月 1 日開始で保存できた。
    expect(
      await f.write(
        [
          {
            ...appointment("appointment:former", "former", { from: "2030-07-01", revision: 2 }),
            state: "void",
          },
        ],
        1,
      ),
    ).toMatchObject({ kind: "applied" })
    expect(
      await f.write([appointment("appointment:successor", "successor", { from: "2030-06-01" })], 2),
    ).toMatchObject({ kind: "applied" })
    // 後任の開始日を 8 月 1 日へ訂正する。時点の参照では 6 月 1 日開始の版はもう使われない。
    expect(
      await f.correct(
        shape === "single"
          ? [appointment("appointment:successor", "successor", { from: "2030-08-01", revision: 2 })]
          : [
              {
                ...appointment("appointment:successor", "successor", {
                  from: "2030-06-01",
                  revision: 2,
                }),
                state: "void",
              },
              appointment("appointment:successor", "successor", {
                from: "2030-08-01",
                revision: 3,
              }),
            ],
        1,
        3,
      ),
    ).toMatchObject({ kind: "applied" })
    expect(await f.holdersOn("2030-06-15")).toEqual(["appointment:former"])
    expect(await f.holdersOn("2030-07-15")).toEqual([])
    expect(await f.holdersOn("2030-08-01")).toEqual(["appointment:successor"])

    await f.database.batch(
      splitSqlStatements(schema.slice(start)).map((sql) => f.database.prepare(sql)),
    )

    expect(
      await f.database
        .prepare("SELECT count(*) AS count FROM company_office_tenure_overlaps")
        .first<number>("count"),
    ).toBe(0)
    expect(await f.write([...bodyPrerequisites, membership("membership:first")], 4)).toMatchObject({
      kind: "applied",
    })
    expect(
      await f.write(
        [appointment("appointment:interim", "member", { from: "2030-07-01", to: "2030-08-01" })],
        5,
      ),
    ).toMatchObject({ kind: "applied" })
    expect(
      await f.write([appointment("appointment:overlap", "member", { from: "2030-07-15" })], 6),
    ).toMatchObject({ kind: "invalid" })
  }
})
