import { describe, expect, test } from "bun:test"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyReportingEmploymentChangeValue } from "@/contexts/company/domain/values/company-reporting-employment-change.value"
import { CompanyReportingRelationTimelineValue } from "@/contexts/company/domain/values/company-reporting-relation-timeline.value"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

function version(
  revision: number,
  startsOn: string,
  manager = "c58922fe-b891-4ee5-878e-e91b0cc75ca0",
  state: "active" | "void" = "active",
) {
  const resource = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "reporting-relation",
    id: "reporting:one",
    revision,
    state,
    effectiveFrom: restoreCalendarDate(startsOn),
    effectiveTo: null,
    attributes: {
      employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
      managerEmployeeId: manager,
      organizationUnitId: "0190005f-0000-7000-8000-c9ae95875c9c",
    },
  })
  if (resource instanceof Error) throw resource
  return resource
}

function change(
  history: ReadonlyArray<CompanyResourceEntity>,
  basis = history,
  end = "2030-07-01",
) {
  const value = CompanyReportingEmploymentChangeValue.create({
    employeeId: "c58922fe-b891-4ee5-878e-e91b0cc75ca0",
    history,
    basis,
    employments: [
      { startsOn: restoreCalendarDate("2030-01-01"), endsOn: restoreCalendarDate(end) },
    ],
  })
  if (value instanceof Error) throw value
  return value
}

function periods(history: ReadonlyArray<CompanyResourceEntity>) {
  const value = CompanyReportingRelationTimelineValue.create(history)
  if (value instanceof Error) throw value
  return value.readPeriods()
}

describe("CompanyReportingEmploymentChangeValue", () => {
  test("元から雇用内で終了する関係と将来の別上長には版を加えない", () => {
    const history = [version(1, "2030-03-01"), version(2, "2030-05-01", "manager:two")]
    expect(change(history).resources).toEqual([])
  })

  test("退職前と別の上長への予約を保ち、退職後の再予約を取消す", () => {
    const history = [
      version(1, "2030-03-01"),
      version(2, "2030-09-01", "manager:two"),
      version(3, "2030-11-01"),
    ]
    const value = change(history)
    expect(
      periods([...history, ...value.resources]).map((period) => [
        period.startsOn,
        period.endsOn,
        period.managerEmployeeId,
      ]),
    ).toEqual([
      ["2030-03-01", "2030-07-01", "c58922fe-b891-4ee5-878e-e91b0cc75ca0"],
      ["2030-09-01", "2030-11-01", "manager:two"],
    ])
  })

  test("再入社は終了済みの上長関係を復活させない", () => {
    const before = [version(1, "2030-03-01")]
    const history = [...before, ...change(before).resources]
    const value = CompanyReportingEmploymentChangeValue.create({
      employeeId: "c58922fe-b891-4ee5-878e-e91b0cc75ca0",
      history,
      basis: history,
      employments: [
        { startsOn: restoreCalendarDate("2030-01-01"), endsOn: restoreCalendarDate("2030-07-01") },
        { startsOn: restoreCalendarDate("2030-09-01"), endsOn: null },
      ],
    })
    if (value instanceof Error) throw value
    expect(value.resources).toEqual([])
    expect(periods(history)).toHaveLength(1)
  })

  test("退職日の訂正では元の関係を復元し、空白と取消を維持する", () => {
    const before = [
      version(1, "2030-03-01"),
      version(2, "2030-05-01", "c58922fe-b891-4ee5-878e-e91b0cc75ca0", "void"),
      version(3, "2030-06-01"),
    ]
    const history = [...before, ...change(before).resources]
    const corrected = change(history, before, "2030-08-01")
    expect(
      periods([...history, ...corrected.resources]).map((period) => [
        period.startsOn,
        period.endsOn,
      ]),
    ).toEqual([
      ["2030-03-01", "2030-05-01"],
      ["2030-06-01", "2030-07-01"],
      ["2030-07-01", "2030-08-01"],
    ])
  })

  test("終了日の訂正は同じ開始日の短縮版が持つ終端も復元する", () => {
    const original = version(1, "2030-03-01")
    const shortened = CompanyResourceEntity.create({
      ...original,
      revision: 2,
      effectiveTo: restoreCalendarDate("2030-07-01"),
    })
    if (shortened instanceof Error) throw shortened
    const history = [original, shortened]
    const corrected = change(history, [original], "2030-08-01")
    expect(
      periods([...history, ...corrected.resources]).map((period) => [
        period.startsOn,
        period.endsOn,
      ]),
    ).toEqual([["2030-03-01", "2030-08-01"]])
  })

  test("版の欠落と別resourceの混入を拒否する", () => {
    expect(
      CompanyReportingEmploymentChangeValue.create({
        employeeId: "c58922fe-b891-4ee5-878e-e91b0cc75ca0",
        history: [version(2, "2030-03-01")],
        basis: [],
        employments: [],
      }),
    ).toBeInstanceOf(Error)
    const first = version(1, "2030-03-01")
    expect(
      CompanyReportingEmploymentChangeValue.create({
        employeeId: "c58922fe-b891-4ee5-878e-e91b0cc75ca0",
        history: [first],
        basis: [version(1, "2030-03-01")],
        employments: [],
      }),
    ).toBeInstanceOf(Error)
  })
})
