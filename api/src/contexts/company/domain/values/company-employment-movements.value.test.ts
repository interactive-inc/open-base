import { expect, test } from "bun:test"
import { CompanyEmploymentMovementsValue } from "@/contexts/company/domain/values/company-employment-movements.value"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

function employment(id: string, startsOn: string, endsOn: string | null): CompanyResourceProps {
  return {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "employment",
    id,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate(startsOn),
    effectiveTo: endsOn === null ? null : restoreCalendarDate(endsOn),
    attributes: {
      employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
      employmentType: "FULL_TIME",
      status: "ACTIVE",
    },
  }
}
function count(histories: ReadonlyArray<ReadonlyArray<CompanyResourceProps>>) {
  return CompanyEmploymentMovementsValue.create({
    histories,
    from: "2026-05-16",
    through: "2026-06-15",
  })
}

test("両端の確定入退社を含め、過去と将来を除く", () => {
  expect(
    count([
      [employment("old", "2026-01-01", "2026-05-15")],
      [employment("recent", "2026-05-16", "2026-06-15")],
      [employment("future", "2026-06-16", null)],
    ]),
  ).toEqual({ joinCount: 1, retireCount: 1 })
})

test("重なった契約と隣接する契約更新は一つの在籍として数える", () => {
  const histories = [
    [employment("first", "2026-05-01", "2026-06-01")],
    [employment("parallel", "2026-05-20", "2026-06-10")],
    [employment("renewed", "2026-06-10", null)],
  ]
  expect(count(histories.toReversed())).toEqual({ joinCount: 0, retireCount: 0 })
})

test("空白を挟んだ再入社は別の在籍開始として数える", () => {
  expect(
    count([
      [employment("first", "2026-05-16", "2026-05-20")],
      [employment("rehire", "2026-06-01", null)],
    ]),
  ).toEqual({ joinCount: 2, retireCount: 1 })
})

test("休職・復職を入退社として数えない", () => {
  const initial = employment("one", "2026-05-01", null)
  expect(
    count([
      [
        initial,
        {
          ...initial,
          revision: 2,
          effectiveFrom: restoreCalendarDate("2026-06-01"),
          attributes: { ...initial.attributes, status: "ON_LEAVE" },
        },
        { ...initial, revision: 3, effectiveFrom: restoreCalendarDate("2026-06-10") },
      ],
    ]),
  ).toEqual({ joinCount: 0, retireCount: 0 })
})

test("遡及訂正と取消は最新の確定期間へ反映する", () => {
  const initial = employment("one", "2026-05-16", "2026-06-01")
  expect(
    count([[initial, { ...initial, revision: 2, effectiveTo: restoreCalendarDate("2026-06-20") }]]),
  ).toEqual({ joinCount: 1, retireCount: 0 })
  expect(count([[initial, { ...initial, revision: 2, state: "void" }]])).toEqual({
    joinCount: 0,
    retireCount: 0,
  })
})

test("異なる従業員の在籍を併合しない", () => {
  const initial = employment("one", "2026-06-01", null)
  expect(
    count([
      [initial],
      [
        {
          ...initial,
          id: "two",
          attributes: { ...initial.attributes, employeeId: "25f122cd-8f0d-49c7-b106-1cd4fdc7bad6" },
        },
      ],
    ]),
  ).toEqual({ joinCount: 2, retireCount: 0 })
})

test("不正な期間と欠けたrevisionを拒否する", () => {
  expect(
    CompanyEmploymentMovementsValue.create({
      histories: [],
      from: "2026-06-15",
      through: "2026-06-01",
    }),
  ).toBeInstanceOf(Error)
  expect(count([[{ ...employment("one", "2026-06-01", null), revision: 2 }]])).toBeInstanceOf(Error)
})

test("半開期間の終了境界ではなく最終在籍日を退職日として数える", () => {
  expect(count([[employment("before", "2026-01-01", "2026-05-16")]])).toEqual({
    joinCount: 0,
    retireCount: 0,
  })
  expect(count([[employment("last", "2026-01-01", "2026-06-16")]])).toEqual({
    joinCount: 0,
    retireCount: 1,
  })
})
