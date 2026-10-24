import { expect, test } from "bun:test"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyEmploymentStartCorrectionValue } from "@/contexts/company/domain/values/company-employment-start-correction.value"
import { CompanyEmploymentResourceTimelineValue } from "@/contexts/company/domain/values/company-employment-resource-timeline.value"
import { CompanyResourceEffectiveHistoryValue } from "@/contexts/company/domain/values/company-resource-effective-history.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const initial = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  type: "employment" as const,
  id: "employment:one",
  revision: 1,
  state: "active" as const,
  effectiveFrom: restoreCalendarDate("2026-01-01"),
  effectiveTo: restoreCalendarDate("2026-07-01"),
  attributes: {
    employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
    employmentType: "PART_TIME",
    status: "ACTIVE",
  },
}
const leave = {
  ...initial,
  revision: 2,
  effectiveFrom: restoreCalendarDate("2026-07-01"),
  effectiveTo: null,
  attributes: { ...initial.attributes, status: "ON_LEAVE" },
}
const history = [initial, leave]

function plan(startsOn: string, correctsRevision = 1) {
  return CompanyEmploymentStartCorrectionValue.create({
    history,
    correctsRevision,
    startsOn: restoreCalendarDate(startsOn),
    commandId: "correct:start",
    recordedAt: 1_000,
  })
}

test("入社日を前倒ししても旧開始境界と既存休職までを訂正履歴で保全する", () => {
  const result = plan("2025-12-01")
  if (result instanceof Error) throw result
  expect(
    result.resources.map((resource) => [resource.revision, resource.effectiveFrom.toString()]),
  ).toEqual([
    [3, "2025-12-01"],
    [4, "2026-01-01"],
  ])
  expect(result.corrections.map((correction) => correction.correctsRevision)).toEqual([1, 1])
  expect(
    result.resources.every((resource) => resource.attributes.employmentType === "PART_TIME"),
  ).toBe(true)
})

test("入社日を後ろ倒しして旧期間を取消し、既存休職と雇用区分を残す", () => {
  const result = plan("2026-02-01")
  if (result instanceof Error) throw result
  expect(
    result.resources.map((resource) => [resource.state, resource.effectiveFrom.toString()]),
  ).toEqual([
    ["void", "2026-01-01"],
    ["active", "2026-02-01"],
  ])
  const corrected = result.resources.map((resource) => ({
    ...resource,
    correctsRevision: result.corrections.find(
      (correction) => correction.revision === resource.revision,
    )?.correctsRevision,
  }))
  expect(CompanyEmploymentResourceTimelineValue.create([...history, ...corrected])).toMatchObject({
    startsOn: "2026-02-01",
    employmentType: "PART_TIME",
    periods: [
      { startsOn: "2026-02-01", endsOn: "2026-07-01", status: "active" },
      { startsOn: "2026-07-01", endsOn: null, status: "leave" },
    ],
  })
})

test("訂正元が古い場合と後続状態を消す開始日は拒否する", () => {
  expect(plan("2025-12-01", 2)).toMatchObject({ code: "invalid_resource" })
  expect(plan("2026-07-01")).toMatchObject({ code: "invalid_period" })
  expect(plan("2026-08-01")).toMatchObject({ code: "invalid_period" })
  expect(plan("2026-01-01")).toMatchObject({ code: "invalid_period" })
})

test("開始日訂正は後続の契約更新と休職の属性を変更しない", () => {
  const fixedTerm = { kind: "FIXED_TERM", startsOn: "2026-01-01", endsBefore: "2026-12-31" }
  const indefinite = { kind: "INDEFINITE", startsOn: "2026-04-01" }
  const source = [
    {
      ...initial,
      effectiveTo: restoreCalendarDate("2026-04-01"),
      attributes: { ...initial.attributes, contractTerm: fixedTerm },
    },
    {
      ...initial,
      revision: 2,
      effectiveFrom: restoreCalendarDate("2026-04-01"),
      attributes: { ...initial.attributes, contractTerm: indefinite },
    },
    {
      ...leave,
      revision: 3,
      attributes: { ...leave.attributes, contractTerm: indefinite },
    },
  ]
  const result = CompanyEmploymentStartCorrectionValue.create({
    history: source,
    correctsRevision: 1,
    startsOn: restoreCalendarDate("2026-02-01"),
    commandId: "correct:contract-start",
    recordedAt: 1_000,
  })
  if (result instanceof Error) throw result
  const effective = CompanyResourceEffectiveHistoryValue.create([
    ...source,
    ...result.resources.map((resource) => ({
      ...resource,
      correctsRevision: result.corrections.find(
        (correction) => correction.revision === resource.revision,
      )?.correctsRevision,
    })),
  ])
  if (effective instanceof Error) throw effective
  expect(
    effective.resources
      .filter((resource) => resource.state === "active")
      .toSorted((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
      .map((resource) => [resource.effectiveFrom.toString(), resource.attributes.contractTerm]),
  ).toEqual([
    ["2026-02-01", fixedTerm],
    ["2026-04-01", indefinite],
    ["2026-07-01", indefinite],
  ])
})
