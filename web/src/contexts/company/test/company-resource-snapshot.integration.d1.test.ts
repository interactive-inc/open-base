import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
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
const organizationId = COMPANY_DEFAULT_ORGANIZATION_ID

async function fixture() {
  const repository = new D1CompanyResourceRepository({
    database: await createLocalD1Database({ schema }),
  })
  const revisions = [
    { date: "2026-01-01", name: "Original", state: "active" },
    { date: "2026-07-01", name: "Future", state: "active" },
    { date: "2026-01-01", name: "Corrected", state: "active" },
    { date: "2026-09-01", name: "Withdrawn", state: "void" },
  ] as const
  for (const [index, revision] of revisions.entries()) {
    const command = CompanyResourceChangeEntity.create({
      commandId: `snapshot:${index}`,
      expectedRevision: index,
      actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      reason: "Confirmed definition",
      recordedAt: index + 1,
      resources: [
        {
          organizationId,
          type: "grade",
          id: "grade:one",
          revision: index + 1,
          state: revision.state,
          effectiveFrom: restoreCalendarDate(revision.date),
          effectiveTo: null,
          attributes: {
            code: index === 1 || index === 3 ? "RENAMED" : "GRADE",
            officialName: revision.name,
          },
        },
      ],
    })
    if (command instanceof Error) throw command
    expect(await repository.write(command)).toMatchObject({ kind: "applied" })
  }
  return repository
}

test("同じ会社版と有効日で再読込しても将来改名・遡及訂正・取消が混ざらない", async () => {
  const repository = await fixture()
  for (const [revision, day, name] of [
    [1, "2026-08-01", "Original"],
    [2, "2026-06-01", "Original"],
    [2, "2026-08-01", "Future"],
    [3, "2026-06-01", "Corrected"],
    [3, "2026-08-01", "Future"],
    [3, "2026-10-01", "Future"],
    [4, "2026-10-01", null],
    [0, "2026-08-01", null],
  ] as const) {
    const snapshot = await repository.findMany({
      organizationId,
      organizationRevision: revision,
      types: ["grade"],
      effectiveOn: restoreCalendarDate(day),
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(snapshot.organizationRevision).toBe(revision)
    expect(
      snapshot.resources.map((resource) => resource.toProps().attributes.officialName),
    ).toEqual(name === null ? [] : [name])
  }
})

test("日付未指定でも指定会社版のheadを返し、不明な版を最新版へ置換しない", async () => {
  const repository = await fixture()
  const snapshot = await repository.findMany({
    organizationId,
    organizationRevision: 2,
    types: ["grade"],
  })
  if (!snapshot.ok) throw snapshot.cause
  expect(snapshot.organizationRevision).toBe(2)
  expect(snapshot.resources.map((resource) => resource.toProps().attributes.officialName)).toEqual([
    "Future",
  ])
  for (const revision of [-1, 0.5, 5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    expect(
      await repository.findMany({
        organizationId,
        organizationRevision: revision,
        types: ["grade"],
      }),
    ).toMatchObject({ ok: false })
  }
  expect(
    await repository.findMany({
      organizationId: "missing",
      organizationRevision: 0,
      types: ["grade"],
    }),
  ).toMatchObject({ ok: false })
})

test("コードは会社版・有効日の資源を選んだ後で照合し、改名した旧版を復活させない", async () => {
  const repository = await fixture()
  for (const [revision, day, code, expected] of [
    [1, "2026-08-01", "GRADE", "Original"],
    [2, "2026-08-01", "GRADE", null],
    [2, "2026-06-01", "GRADE", "Original"],
    [2, "2026-08-01", "RENAMED", "Future"],
    [3, "2026-08-01", "GRADE", null],
    [3, "2026-06-01", "GRADE", "Corrected"],
    [4, "2026-10-01", "RENAMED", null],
  ] as const) {
    const snapshot = await repository.findMany({
      organizationId,
      organizationRevision: revision,
      effectiveOn: restoreCalendarDate(day),
      types: ["grade"],
      codes: [code],
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(
      snapshot.resources.map((resource) => resource.toProps().attributes.officialName),
    ).toEqual(expected === null ? [] : [expected])
  }
  for (const query of [
    { organizationRevision: 2 },
    { effectiveOn: restoreCalendarDate("2026-08-01") },
    {},
  ]) {
    const snapshot = await repository.findMany({
      organizationId,
      types: ["grade"],
      codes: ["GRADE"],
      ...query,
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(snapshot.resources).toEqual([])
  }
  const quoted = await repository.findMany({
    organizationId,
    types: ["grade"],
    codes: ["GRADE' OR 1=1 --"],
    organizationRevision: 1,
  })
  expect(quoted).toMatchObject({ ok: true, resources: [] })
  const overLimit = await repository.findMany({
    organizationId,
    types: ["grade"],
    codes: Array.from({ length: 101 }, () => "GRADE"),
  })
  expect(overLimit).toMatchObject({ ok: false })
})

test("訂正による旧開始日の取消は前倒しした期間へ戻り、通常の将来取消は期間を終了する", async () => {
  const repository = new D1CompanyResourceRepository({
    database: await createLocalD1Database({ schema }),
  })
  const resource = {
    organizationId,
    type: "grade" as const,
    id: "grade:corrected-start",
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2026-02-01"),
    effectiveTo: null,
    attributes: { code: "GRADE", officialName: "Confirmed grade" },
  }
  const initial = CompanyResourceChangeEntity.create({
    commandId: "grade:initial",
    expectedRevision: 0,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Original source",
    recordedAt: 1,
    resources: [{ ...resource, revision: 1 }],
  })
  if (initial instanceof Error) throw initial
  expect(await repository.write(initial)).toMatchObject({ kind: "applied" })
  const correction = CompanyResourceChangeEntity.createHistoryBatch({
    commandId: "grade:correct-start",
    expectedRevision: 1,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Original source confirms earlier start",
    recordedAt: 2,
    evidenceReferences: [
      { context: "system", kind: "document", id: "grade:original", version: "1" },
    ],
    corrections: [2, 3].map((revision) => ({
      type: "grade" as const,
      id: resource.id,
      revision,
      correctsRevision: 1,
    })),
    resources: [
      { ...resource, revision: 2, state: "void" as const },
      { ...resource, revision: 3, effectiveFrom: restoreCalendarDate("2026-01-01") },
    ],
  })
  if (correction instanceof Error) throw correction
  expect(await repository.write(correction)).toMatchObject({ kind: "applied" })
  for (const revision of [undefined, 2] as const) {
    const snapshot = await repository.findMany({
      organizationId,
      organizationRevision: revision,
      types: ["grade"],
      effectiveOn: restoreCalendarDate("2026-03-01"),
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(snapshot.resources.map((item) => item.toProps().effectiveFrom)).toEqual([
      restoreCalendarDate("2026-01-01"),
    ])
  }
  const ordinaryCancellation = CompanyResourceChangeEntity.create({
    commandId: "grade:future-cancel",
    expectedRevision: 2,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Future cancellation",
    recordedAt: 3,
    resources: [
      {
        ...resource,
        revision: 4,
        state: "void",
        effectiveFrom: restoreCalendarDate("2026-04-01"),
      },
    ],
  })
  if (ordinaryCancellation instanceof Error) throw ordinaryCancellation
  expect(await repository.write(ordinaryCancellation)).toMatchObject({ kind: "applied" })
  const afterCancellation = await repository.findMany({
    organizationId,
    types: ["grade"],
    effectiveOn: restoreCalendarDate("2026-04-02"),
  })
  if (!afterCancellation.ok) throw afterCancellation.cause
  expect(afterCancellation.resources).toEqual([])
})

test("単一revisionで開始日を前倒しする訂正も旧開始日の資源を復活させない", async () => {
  const repository = new D1CompanyResourceRepository({
    database: await createLocalD1Database({ schema }),
  })
  const original = {
    organizationId,
    type: "grade" as const,
    id: "grade:single-correction",
    revision: 1,
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2026-02-01"),
    effectiveTo: null,
    attributes: { code: "GRADE", officialName: "Grade" },
  }
  const first = CompanyResourceChangeEntity.create({
    commandId: "grade:single-initial",
    expectedRevision: 0,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Original source",
    recordedAt: 1,
    resources: [original],
  })
  if (first instanceof Error) throw first
  expect(await repository.write(first)).toMatchObject({ kind: "applied" })
  const correction = CompanyResourceChangeEntity.create({
    commandId: "grade:single-correct",
    expectedRevision: 1,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Original source confirms earlier start",
    recordedAt: 2,
    evidenceReferences: [
      { context: "system", kind: "document", id: "grade:single-original", version: "1" },
    ],
    corrections: [{ type: "grade", id: original.id, revision: 2, correctsRevision: 1 }],
    resources: [{ ...original, revision: 2, effectiveFrom: restoreCalendarDate("2026-01-01") }],
  })
  if (correction instanceof Error) throw correction
  expect(await repository.write(correction)).toMatchObject({ kind: "applied" })
  const beforeCorrection = await repository.findMany({
    organizationId,
    organizationRevision: 1,
    types: ["grade"],
    effectiveOn: restoreCalendarDate("2026-03-01"),
  })
  if (!beforeCorrection.ok) throw beforeCorrection.cause
  expect(beforeCorrection.resources.map((item) => item.toProps().effectiveFrom)).toEqual([
    restoreCalendarDate("2026-02-01"),
  ])
  for (const organizationRevision of [undefined, 2] as const) {
    const snapshot = await repository.findMany({
      organizationId,
      organizationRevision,
      types: ["grade"],
      effectiveOn: restoreCalendarDate("2026-03-01"),
    })
    if (!snapshot.ok) throw snapshot.cause
    expect(snapshot.resources.map((item) => item.toProps().effectiveFrom)).toEqual([
      restoreCalendarDate("2026-01-01"),
    ])
  }
})
