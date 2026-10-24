import type { CompanyJsonObject } from "@/contexts/company/domain/entities/company-resource.entity"
import { expect, setDefaultTimeout, test } from "bun:test"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyPlaceTestContext } from "@/contexts/company/test/company-place.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test.each(["legalEntity", "site", "unit"] as const)(
  "参照中の %s を短縮して勤務場所を期間外へ残す変更を拒否する",
  async (kind) => {
    const f = await createCompanyPlaceTestContext()
    expect(await f.write({ resources: f.resources, expectedRevision: 0 })).toMatchObject({
      kind: "applied",
    })
    const before = await f.saved()
    expect(
      await f.write({
        resources: [{ ...f[kind], revision: 2, effectiveTo: restoreCalendarDate("2030-07-01") }],
        expectedRevision: 1,
      }),
    ).toMatchObject({ kind: "invalid" })
    expect(await f.saved()).toEqual(before)
  },
)

test.each(["legalEntity", "site", "unit"] as const)(
  "参照先 %s の開始前の利用を拒否する",
  async (kind) => {
    const f = await createCompanyPlaceTestContext()
    const before = await f.saved()
    const resources = f.resources.map((resource) =>
      resource === f[kind]
        ? { ...resource, effectiveFrom: restoreCalendarDate("2030-07-01") }
        : resource,
    )
    expect(await f.write({ resources, expectedRevision: 0 })).toMatchObject({ kind: "invalid" })
    expect(await f.saved()).toEqual(before)
  },
)

test.each(["legalEntity", "site", "unit"] as const)(
  "別organizationの %s で参照を補わない",
  async (kind) => {
    const f = await createCompanyPlaceTestContext()
    expect(
      await f.write({
        resources: f.resources.map((resource) => ({
          ...resource,
          organizationId: "01900060-0000-7000-8000-12268fccf2cc",
        })),
        expectedRevision: 0,
      }),
    ).toMatchObject({ kind: "applied" })
    const before = await f.saved()
    expect(
      await f.write({
        resources: f.resources.filter((resource) => resource !== f[kind]),
        expectedRevision: 0,
        commandId: "default-command",
      }),
    ).toMatchObject({ kind: "invalid" })
    expect(await f.saved()).toEqual(before)
  },
)

test("勤務場所は組織の安定IDを参照し、期間IDや存在しない組織を拒否する", async () => {
  for (const target of [
    "0190005f-0000-7000-8000-0e0100000001",
    "0190005f-0000-7000-8000-ccdf3ed2f2b6",
  ]) {
    const f = await createCompanyPlaceTestContext()
    expect(
      await f.write({
        resources: f.resources.map((resource) =>
          resource === f.workplace
            ? { ...resource, attributes: { ...resource.attributes, organizationUnitId: target } }
            : resource,
        ),
        expectedRevision: 0,
      }),
    ).toMatchObject({ kind: "invalid" })
  }
  const optionalAffiliations: ReadonlyArray<CompanyJsonObject> = [
    { code: "REMOTE", officialName: "Remote", kind: "remote", siteId: "site:office" },
    {
      code: "REMOTE",
      officialName: "Remote",
      kind: "remote",
      siteId: "site:office",
      organizationUnitId: null,
    },
  ]
  for (const attributes of optionalAffiliations) {
    const f = await createCompanyPlaceTestContext()
    expect(
      await f.write({
        resources: [f.legalEntity, f.site, { ...f.workplace, attributes }],
        expectedRevision: 0,
      }),
    ).toMatchObject({ kind: "applied" })
  }
})

test("法人の連続した版を参照でき、途中にある期間の空白を拒否する", async () => {
  for (const startsOn of ["2030-07-01", "2030-08-01"]) {
    const f = await createCompanyPlaceTestContext()
    expect(
      await f.write({
        resources: [{ ...f.legalEntity, effectiveTo: restoreCalendarDate("2030-07-01") }],
        expectedRevision: 0,
      }),
    ).toMatchObject({ kind: "applied" })
    expect(
      await f.write({
        resources: [
          { ...f.legalEntity, revision: 2, effectiveFrom: restoreCalendarDate(startsOn) },
        ],
        expectedRevision: 1,
      }),
    ).toMatchObject({ kind: "applied" })
    const before = await f.saved()
    const result = await f.write({ resources: [f.workplace, f.site, f.unit], expectedRevision: 2 })
    expect(result).toMatchObject({ kind: startsOn === "2030-07-01" ? "applied" : "invalid" })
    if (startsOn !== "2030-07-01") expect(await f.saved()).toEqual(before)
  }
})

test("組織の連続した期間を勤務場所が参照し、訂正で空白を作れない", async () => {
  const f = await createCompanyPlaceTestContext()
  const boundary = restoreCalendarDate("2030-07-01")
  expect(
    await f.write({
      resources: [
        f.legalEntity,
        f.site,
        { ...f.unit, effectiveTo: boundary },
        { ...f.unit, id: "0190005f-0000-7000-8000-0e0100000003", effectiveFrom: boundary },
        f.workplace,
      ],
      expectedRevision: 0,
    }),
  ).toMatchObject({ kind: "applied" })
  const before = await f.saved()
  expect(
    await f.write({
      resources: [
        {
          ...f.unit,
          id: "0190005f-0000-7000-8000-0e0100000003",
          revision: 2,
          effectiveFrom: restoreCalendarDate("2030-08-01"),
        },
      ],
      expectedRevision: 1,
    }),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
})

test("参照元と参照先を同じcommandで短縮・延長でき、再送で履歴を増やさない", async () => {
  const f = await createCompanyPlaceTestContext()
  expect(await f.write({ resources: f.resources.toReversed(), expectedRevision: 0 })).toMatchObject(
    { kind: "applied" },
  )
  const shortened = f.resources.map((resource) => ({
    ...resource,
    revision: 2,
    effectiveTo: restoreCalendarDate("2030-07-01"),
  }))
  expect(await f.write({ resources: shortened, expectedRevision: 1 })).toMatchObject({
    kind: "applied",
    replayed: false,
  })
  const before = await f.saved()
  expect(await f.write({ resources: shortened, expectedRevision: 1 })).toMatchObject({
    kind: "applied",
    replayed: true,
  })
  expect(await f.saved()).toEqual(before)
  expect(await f.write({ resources: shortened.toReversed(), expectedRevision: 1 })).toMatchObject({
    kind: "command_conflict",
  })
  expect(
    await f.write({ resources: [{ ...f.site, revision: 3 }], expectedRevision: 2 }),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
  expect(
    await f.write({
      resources: f.resources.map((resource) => ({ ...resource, revision: 3 })),
      expectedRevision: 2,
    }),
  ).toMatchObject({ kind: "applied" })
})

test("将来取消の後も過去の参照を保全し、閉鎖済み拠点の勤務場所を訂正できる", async () => {
  const f = await createCompanyPlaceTestContext()
  const boundary = restoreCalendarDate("2030-07-01")
  expect(await f.write({ resources: f.resources, expectedRevision: 0 })).toMatchObject({
    kind: "applied",
  })
  expect(
    await f.write({
      resources: [f.legalEntity, f.site, f.workplace].map((resource) => ({
        ...resource,
        revision: 2,
        state: "void",
        effectiveFrom: boundary,
      })),
      expectedRevision: 1,
    }),
  ).toMatchObject({ kind: "applied" })
  const before = await f.saved()
  expect(
    await f.write({
      resources: [{ ...f.site, revision: 3, effectiveTo: restoreCalendarDate("2030-06-01") }],
      expectedRevision: 2,
    }),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
  expect(
    await f.write({
      resources: [
        {
          ...f.workplace,
          revision: 3,
          effectiveTo: boundary,
          attributes: { ...f.workplace.attributes, officialName: "Corrected office name" },
        },
      ],
      expectedRevision: 2,
    }),
  ).toMatchObject({ kind: "applied" })
  for (const date of ["2030-06-30", "2030-07-01"]) {
    const result = await f.repository.findMany({
      organizationId: f.common.organizationId,
      types: ["legal-entity", "site", "workplace"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!result.ok) throw result.cause
    expect(result.resources).toHaveLength(date === "2030-06-30" ? 3 : 0)
  }
})

test("拠点の運営法人の変更は旧法人と新法人の各期間で検査する", async () => {
  const f = await createCompanyPlaceTestContext()
  const boundary = restoreCalendarDate("2030-07-01")
  expect(await f.write({ resources: f.resources, expectedRevision: 0 })).toMatchObject({
    kind: "applied",
  })
  const moved = [
    { ...f.legalEntity, revision: 2, effectiveTo: boundary },
    { ...f.legalEntity, id: "legal:next", effectiveFrom: boundary },
    {
      ...f.site,
      revision: 2,
      effectiveFrom: boundary,
      attributes: { ...f.site.attributes, legalEntityId: "legal:next" },
    },
  ]
  expect(await f.write({ resources: moved, expectedRevision: 1 })).toMatchObject({
    kind: "applied",
  })
  const before = await f.saved()
  expect(
    await f.write({
      resources: [
        { ...f.legalEntity, revision: 3, effectiveTo: restoreCalendarDate("2030-06-01") },
      ],
      expectedRevision: 2,
    }),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
})
