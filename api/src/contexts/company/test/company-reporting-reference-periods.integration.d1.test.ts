import { expect, setDefaultTimeout, test } from "bun:test"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { createCompanyReportingReferenceTestContext } from "@/contexts/company/test/company-reporting-reference.test-support"
import { createCompanyPlaceHttpTestClient } from "@/contexts/company/test/company-place-http.test-support"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("公開APIは終了済み上長関係の過去を孤立させる組織訂正を拒否する", async () => {
  const f = await createCompanyReportingReferenceTestContext()
  expect(await f.write({ resources: f.resources, expectedRevision: 0 })).toMatchObject({
    kind: "applied",
  })
  expect(await f.write({ resources: [f.closed], expectedRevision: 1 })).toMatchObject({
    kind: "applied",
  })
  const before = await f.saved()
  const request = createCompanyPlaceHttpTestClient(f.database)
  const unit = { ...f.unit, revision: 2, effectiveTo: restoreCalendarDate("2030-06-01") }
  const rejected = await request({
    path: "/company/organization-changes",
    revision: 2,
    resources: [unit],
  })
  expect({ status: rejected.status, body: await rejected.json() }).toMatchObject({ status: 422 })
  expect(await f.saved()).toEqual(before)
  const corrected = { ...f.reporting, revision: 3, effectiveTo: unit.effectiveTo }
  const resources = [unit, corrected]
  const accepted = await request({ path: "/company/organization-changes", revision: 2, resources })
  expect({ status: accepted.status, body: await accepted.json() }).toMatchObject({ status: 201 })
  const saved = await f.saved()
  expect(
    (await request({ path: "/company/organization-changes", revision: 2, resources })).status,
  ).toBe(200)
  expect(await f.saved()).toEqual(saved)
})

test.each(["starts-after", "ends-before", "period-id", "missing-unit"])(
  "Repositoryへの直接保存でも上長関係の組織参照を検査する: %s",
  async (kind) => {
    const f = await createCompanyReportingReferenceTestContext()
    const unit = {
      ...f.unit,
      effectiveFrom:
        kind === "starts-after" ? restoreCalendarDate("2030-02-01") : f.unit.effectiveFrom,
      effectiveTo: kind === "ends-before" ? restoreCalendarDate("2030-06-01") : f.unit.effectiveTo,
    }
    const reporting = {
      ...f.reporting,
      attributes: {
        ...f.reporting.attributes,
        organizationUnitId:
          kind === "period-id"
            ? f.unit.id
            : kind === "missing-unit"
              ? "0190005f-0000-7000-8000-ccdf3ed2f2b6"
              : "0190005f-0000-7000-8000-3d39a82ae356",
      },
    }
    const before = await f.saved()
    expect(
      await f.write({ resources: [unit, ...f.people, reporting], expectedRevision: 0 }),
    ).toMatchObject({ kind: "invalid" })
    expect(await f.saved()).toEqual(before)
  },
)

test("連続した組織期間は参照できるが、終了後の訂正で期間の空白を作れない", async () => {
  const f = await createCompanyReportingReferenceTestContext()
  const boundary = restoreCalendarDate("2030-04-01")
  const first = { ...f.unit, effectiveTo: boundary }
  const second = { ...f.unit, id: "0190005f-0000-7000-8000-0e0100000003", effectiveFrom: boundary }
  expect(
    await f.write({ resources: [first, second, ...f.people, f.reporting], expectedRevision: 0 }),
  ).toMatchObject({ kind: "applied" })
  expect(await f.write({ resources: [f.closed], expectedRevision: 1 })).toMatchObject({
    kind: "applied",
  })
  const before = await f.saved()
  expect(
    await f.write({
      resources: [{ ...second, revision: 2, effectiveFrom: restoreCalendarDate("2030-05-01") }],
      expectedRevision: 2,
    }),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
})

test("別organizationに同じ組織IDがあっても上長関係の参照を補わない", async () => {
  const f = await createCompanyReportingReferenceTestContext()
  expect(
    await f.write({
      resources: [{ ...f.unit, organizationId: "01900060-0000-7000-8000-12268fccf2cc" }],
      expectedRevision: 0,
    }),
  ).toMatchObject({ kind: "applied" })
  const before = await f.saved()
  expect(
    await f.write({ resources: [...f.people, f.reporting], expectedRevision: 0 }),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
})

test("期間を定めない上長関係を、有限の組織期間では補えない", async () => {
  const f = await createCompanyReportingReferenceTestContext()
  const before = await f.saved()
  expect(
    await f.write({
      resources: [
        { ...f.unit, effectiveTo: restoreCalendarDate("9999-12-31") },
        ...f.people,
        { ...f.reporting, effectiveTo: null },
      ],
      expectedRevision: 0,
    }),
  ).toMatchObject({ kind: "invalid" })
  expect(await f.saved()).toEqual(before)
})

test("上長関係の組織変更前後をそれぞれ保全し、終了した関係の過去を失わない", async () => {
  const f = await createCompanyReportingReferenceTestContext()
  const teams = ["first", "next"].map((name) => ({
    ...f.unit,
    id:
      name === "first"
        ? "0190005f-0000-7000-8000-0e010000000c"
        : "0190005f-0000-7000-8000-0e0100000003",
    attributes: {
      ...f.unit.attributes,
      organizationUnitId:
        name === "first"
          ? "0190005f-0000-7000-8000-cba7c7adb88f"
          : "0190005f-0000-7000-8000-0b68139f5ae9",
      code: name.toUpperCase(),
      kind: "TEAM",
      parentOrganizationUnitId: "0190005f-0000-7000-8000-3d39a82ae356",
    },
  }))
  const reporting = {
    ...f.reporting,
    effectiveTo: null,
    attributes: {
      ...f.reporting.attributes,
      organizationUnitId: "0190005f-0000-7000-8000-cba7c7adb88f",
    },
  }
  expect(
    await f.write({ resources: [f.unit, ...teams, ...f.people, reporting], expectedRevision: 0 }),
  ).toMatchObject({ kind: "applied" })
  const moved = {
    ...reporting,
    revision: 2,
    effectiveFrom: restoreCalendarDate("2030-07-01"),
    attributes: {
      ...reporting.attributes,
      organizationUnitId: "0190005f-0000-7000-8000-0b68139f5ae9",
    },
  }
  expect(await f.write({ resources: [moved], expectedRevision: 1 })).toMatchObject({
    kind: "applied",
  })
  expect(
    await f.write({
      resources: [
        { ...moved, revision: 3, state: "void", effectiveFrom: restoreCalendarDate("2031-01-01") },
      ],
      expectedRevision: 2,
    }),
  ).toMatchObject({ kind: "applied" })
  const before = await f.saved()
  for (const team of teams) {
    expect(
      await f.write({
        resources: [{ ...team, revision: 2, effectiveTo: restoreCalendarDate("2030-06-01") }],
        expectedRevision: 3,
      }),
    ).toMatchObject({ kind: "invalid" })
    expect(await f.saved()).toEqual(before)
  }
  expect(
    await f.write({
      resources: teams.map((team) => ({
        ...team,
        revision: 2,
        effectiveTo: restoreCalendarDate(
          team.id === "0190005f-0000-7000-8000-0e010000000c" ? "2030-07-01" : "2031-01-01",
        ),
      })),
      expectedRevision: 3,
    }),
  ).toMatchObject({ kind: "applied" })
})
