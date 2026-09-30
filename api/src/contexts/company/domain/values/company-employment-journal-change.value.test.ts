import { describe, expect, test } from "bun:test"
import { CompanyEmploymentJournalChangeValue } from "@/contexts/company/domain/values/company-employment-journal-change.value"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const employeeId = restoreWorkforceId("employee", "employee:journal")
const employmentId = restoreWorkforceId("employment", "employment:journal")
const attributes = { employeeId, employmentType: "PART_TIME", status: "ACTIVE" }
const base = {
  periodId: employmentId,
  revision: 1,
  startsOn: "2026-01-01",
  endsOn: null,
  isVoid: false,
  recordedByActionId: "action:initial",
  recordedAt: 1,
}
const employment = { ...base, employeeId, employmentId }
const status = {
  ...base,
  periodId: "status:initial",
  employeeId,
  employmentPeriodId: employmentId,
  status: "active",
} satisfies Parameters<typeof CompanyEmploymentJournalChangeValue.create>[0]["statuses"][number]
function initial() {
  const value = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "employment",
    id: employmentId,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate(base.startsOn),
    effectiveTo: null,
    attributes,
  })
  if (value instanceof Error) throw value
  return value
}
function changes(
  props: Partial<Parameters<typeof CompanyEmploymentJournalChangeValue.create>[0]> = {},
) {
  return CompanyEmploymentJournalChangeValue.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    employment,
    statuses: [status],
    history: [initial()],
    initialAttributes: attributes,
    ...props,
  })
}

describe("期間訂正から公開雇用の追記を作る", () => {
  test("旧形式を訂正した後も退職を追記でき、退職日を含む期間を保つ", () => {
    const history = [
      { ...initial().toProps(), attributes: { ...attributes, status: "RETIRED" } },
      { ...initial().toProps(), revision: 2 },
    ]
    const result = changes({
      history,
      employment: { ...employment, endsOn: "2026-08-17" },
      statuses: [{ ...status, endsOn: "2026-08-17" }],
    })
    if (result instanceof Error) throw result
    expect(result.resources[0]?.revision).toBe(3)
    expect(
      CompanyEmploymentResourceTimelineValue.create([...history, ...result.resources]),
    ).toMatchObject({
      startsOn: "2026-01-01",
      endsOn: "2026-08-17",
      periods: [{ startsOn: "2026-01-01", endsOn: "2026-08-17", status: "active" }],
    })
    expect(changes({ history: history.slice(0, 1) })).toBeInstanceOf(Error)
  })

  test("変更がない場合はrevisionを増やさない", () => {
    expect(changes()).toMatchObject({ resources: [] })
  })
  test("休職後の復職を追加しても雇用区分と既存の開始日を維持する", () => {
    const result = changes({
      statuses: [
        { ...status, endsOn: "2026-07-01" },
        {
          ...status,
          periodId: "status:leave",
          status: "leave",
          startsOn: "2026-07-01",
          endsOn: "2026-09-01",
        },
        { ...status, periodId: "status:return", startsOn: "2026-09-01" },
      ],
    })
    if (result instanceof Error) throw result
    expect(result.resources.map((resource) => resource.revision)).toEqual([2, 3, 4])
    expect(
      CompanyEmploymentResourceTimelineValue.create([initial(), ...result.resources]),
    ).toMatchObject({
      employmentType: "PART_TIME",
      periods: [
        { startsOn: "2026-01-01", endsOn: "2026-07-01", status: "active" },
        { startsOn: "2026-07-01", endsOn: "2026-09-01", status: "leave" },
        { startsOn: "2026-09-01", endsOn: null, status: "active" },
      ],
    })
  })
  test("開始日を後ろへ訂正したら旧開始日をvoidにし、在籍を復活させない", () => {
    const result = changes({
      employment: { ...employment, startsOn: "2026-02-01" },
      statuses: [{ ...status, startsOn: "2026-02-01" }],
    })
    if (result instanceof Error) throw result
    expect(
      CompanyEmploymentResourceTimelineValue.create([initial(), ...result.resources]),
    ).toMatchObject({
      startsOn: "2026-02-01",
      periods: [{ startsOn: "2026-02-01", endsOn: null, status: "active" }],
    })
  })
  test("開始日を前へ訂正しても後続の旧発効境界で雇用開始日を戻さない", () => {
    const history = [
      initial().toProps(),
      {
        ...initial().toProps(),
        revision: 2,
        effectiveFrom: restoreCalendarDate("2026-07-01"),
        attributes: { ...attributes, status: "ON_LEAVE" },
      },
    ]
    const result = changes({
      history,
      employment: { ...employment, startsOn: "2025-12-01" },
      statuses: [
        { ...status, startsOn: "2025-12-01", endsOn: "2026-07-01" },
        {
          ...status,
          periodId: "status:leave",
          startsOn: "2026-07-01",
          status: "leave",
        },
      ],
    })
    if (result instanceof Error) throw result
    const timeline = CompanyEmploymentResourceTimelineValue.create([
      ...history,
      ...result.resources,
    ])
    expect(timeline).toMatchObject({
      startsOn: "2025-12-01",
      periods: [
        { startsOn: "2025-12-01", endsOn: "2026-07-01", status: "active" },
        { startsOn: "2026-07-01", endsOn: null, status: "leave" },
      ],
    })
  })
  test("元の開始revisionを訂正しても既存の休職までの在籍期間を失わない", () => {
    const history = [
      { ...initial().toProps(), effectiveTo: restoreCalendarDate("2026-07-01") },
      {
        ...initial().toProps(),
        revision: 2,
        effectiveFrom: restoreCalendarDate("2026-07-01"),
        attributes: { ...attributes, status: "ON_LEAVE" },
      },
    ]
    const result = changes({
      history,
      correctingStartRevision: 1,
      employment: { ...employment, startsOn: "2025-12-01" },
      statuses: [
        { ...status, startsOn: "2025-12-01", endsOn: "2026-07-01" },
        { ...status, periodId: "status:leave", startsOn: "2026-07-01", status: "leave" },
      ],
    })
    if (result instanceof Error) throw result
    expect(result.resources.map((resource) => resource.effectiveFrom.toString())).toEqual([
      "2025-12-01",
      "2026-01-01",
    ])
    const corrected = result.resources.map((resource) => ({
      ...resource.toProps(),
      correctsRevision: 1,
    }))
    expect(CompanyEmploymentResourceTimelineValue.create([...history, ...corrected])).toMatchObject(
      {
        startsOn: "2025-12-01",
        periods: [
          { startsOn: "2025-12-01", endsOn: "2026-07-01", status: "active" },
          { startsOn: "2026-07-01", endsOn: null, status: "leave" },
        ],
      },
    )
    expect(
      changes({
        history,
        correctingStartRevision: 2,
        employment: { ...employment, startsOn: "2025-12-01" },
        statuses: [{ ...status, startsOn: "2025-12-01" }],
      }),
    ).toMatchObject({ code: "invalid_resource" })
  })
  test("開始日を後ろへ訂正しても既存の休職と雇用区分を維持する", () => {
    const history = [
      { ...initial().toProps(), effectiveTo: restoreCalendarDate("2026-07-01") },
      {
        ...initial().toProps(),
        revision: 2,
        effectiveFrom: restoreCalendarDate("2026-07-01"),
        attributes: { ...attributes, status: "ON_LEAVE" },
      },
    ]
    const result = changes({
      history,
      correctingStartRevision: 1,
      employment: { ...employment, startsOn: "2026-02-01" },
      statuses: [
        { ...status, startsOn: "2026-02-01", endsOn: "2026-07-01" },
        { ...status, periodId: "status:leave", startsOn: "2026-07-01", status: "leave" },
      ],
    })
    if (result instanceof Error) throw result
    expect(
      result.resources.map((resource) => [resource.state, resource.effectiveFrom.toString()]),
    ).toEqual([
      ["void", "2026-01-01"],
      ["active", "2026-02-01"],
    ])
    const corrected = result.resources.map((resource) => ({
      ...resource.toProps(),
      correctsRevision: 1,
    }))
    expect(CompanyEmploymentResourceTimelineValue.create([...history, ...corrected])).toMatchObject(
      {
        startsOn: "2026-02-01",
        employmentType: "PART_TIME",
        periods: [
          { startsOn: "2026-02-01", endsOn: "2026-07-01", status: "active" },
          { startsOn: "2026-07-01", endsOn: null, status: "leave" },
        ],
      },
    )
  })
  test("期間取消は古い発効境界も取り消す", () => {
    const result = changes({ employment: { ...employment, isVoid: true }, statuses: [] })
    if (result instanceof Error) throw result
    expect(
      CompanyEmploymentResourceTimelineValue.create([initial(), ...result.resources]),
    ).toMatchObject({ periods: [] })
  })
  test("在籍状態の欠落・重複と所有者の不一致を拒否する", () => {
    expect(changes({ statuses: [] })).toBeInstanceOf(Error)
    expect(
      changes({ statuses: [status, { ...status, periodId: "status:duplicate" }] }),
    ).toBeInstanceOf(Error)
    expect(
      changes({
        statuses: [{ ...status, employeeId: restoreWorkforceId("employee", "employee:other") }],
      }),
    ).toBeInstanceOf(Error)
  })

  test("不正な日付や逆転した期間を履歴へ変換しない", () => {
    expect(changes({ employment: { ...employment, startsOn: "2026-02-30" } })).toMatchObject({
      code: "invalid_period",
    })
    expect(changes({ statuses: [{ ...status, endsOn: "2025-12-31" }] })).toMatchObject({
      code: "invalid_period",
    })
  })
})
