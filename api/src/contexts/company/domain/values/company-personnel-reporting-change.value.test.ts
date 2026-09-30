import { describe, expect, test } from "bun:test"
import { CompanyPersonnelReportingChangeValue } from "@/contexts/company/domain/values/company-personnel-reporting-change.value"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyReportingRelationTimelineValue } from "@/contexts/company/domain/values/company-reporting-relation-timeline.value"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const january = restoreCalendarDate("2030-01-01")
const march = restoreCalendarDate("2030-03-01")
const april = restoreCalendarDate("2030-04-01")
const july = restoreCalendarDate("2030-07-01")
const scope = {
  resourceId: "line:one",
  employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
  organizationUnitId: "0190005f-0000-7000-8000-c9ae95875c9c",
}

function version(
  revision: number,
  start = march,
  manager = "manager:one",
  state: "active" | "void" = "active",
) {
  const resource = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "reporting-relation",
    id: scope.resourceId,
    revision,
    state,
    effectiveFrom: start,
    effectiveTo: null,
    attributes: {
      employeeId: scope.employeeId,
      organizationUnitId: scope.organizationUnitId,
      managerEmployeeId: manager,
    },
  })
  if (resource instanceof Error) throw resource
  return resource
}

function periods(history: ReadonlyArray<CompanyResourceEntity>) {
  const value = CompanyReportingRelationTimelineValue.create(history)
  if (value instanceof Error) throw value
  return value.readPeriods()
}

describe("CompanyPersonnelReportingChangeValue", () => {
  test("役職による所属の分割だけでは指揮命令の版を増やさない", () => {
    const history = [version(1)]
    const value = CompanyPersonnelReportingChangeValue.create({
      ...scope,
      history,
      basis: history,
      coverage: [
        { startsOn: january, endsOn: march },
        { startsOn: march, endsOn: april },
        { startsOn: april, endsOn: null },
      ],
    })
    if (value instanceof Error) throw value
    expect(value.resources).toEqual([])
  })

  test("現在の上長変更は将来の明示した上長予約を保つ", () => {
    const history = [version(1), version(2, july, "manager:future")]
    const value = CompanyPersonnelReportingChangeValue.create({
      ...scope,
      history,
      basis: history,
      coverage: [{ startsOn: january, endsOn: null }],
      replacement: { startsOn: april, endsOn: july, managerEmployeeId: "manager:current" },
    })
    if (value instanceof Error) throw value
    expect(periods([...history, ...value.resources])).toEqual([
      {
        employeeId: scope.employeeId,
        organizationUnitId: scope.organizationUnitId,
        managerEmployeeId: "manager:one",
        startsOn: march,
        endsOn: april,
      },
      {
        employeeId: scope.employeeId,
        organizationUnitId: scope.organizationUnitId,
        managerEmployeeId: "manager:current",
        startsOn: april,
        endsOn: july,
      },
      {
        employeeId: scope.employeeId,
        organizationUnitId: scope.organizationUnitId,
        managerEmployeeId: "manager:future",
        startsOn: july,
        endsOn: null,
      },
    ])
  })

  test("所属の空白と終了を補わず、上長なしの指定後も旧版を復活させない", () => {
    const history = [version(1, january)]
    const value = CompanyPersonnelReportingChangeValue.create({
      ...scope,
      history,
      basis: history,
      coverage: [
        { startsOn: january, endsOn: march },
        { startsOn: april, endsOn: july },
      ],
      replacement: { startsOn: april, endsOn: july, managerEmployeeId: null },
    })
    if (value instanceof Error) throw value
    expect(periods([...history, ...value.resources])).toEqual([
      {
        employeeId: scope.employeeId,
        organizationUnitId: scope.organizationUnitId,
        managerEmployeeId: "manager:one",
        startsOn: january,
        endsOn: march,
      },
    ])
  })

  test("取消対象の記録前を基に訂正し、確認した後続版を保持する", () => {
    const original = version(1, january)
    const history = [
      original,
      version(2, march, "manager:wrong"),
      version(3, july, "manager:future"),
    ]
    const value = CompanyPersonnelReportingChangeValue.create({
      ...scope,
      history,
      basis: [original, history[2]!],
      coverage: [{ startsOn: january, endsOn: null }],
      replacement: { startsOn: april, endsOn: july, managerEmployeeId: "manager:correct" },
    })
    if (value instanceof Error) throw value
    expect(
      periods([...history, ...value.resources]).map((period) => [
        period.startsOn,
        period.managerEmployeeId,
      ]),
    ).toEqual([
      [january, "manager:one"],
      [march, "manager:one"],
      [april, "manager:correct"],
      [july, "manager:future"],
    ])
  })
})
