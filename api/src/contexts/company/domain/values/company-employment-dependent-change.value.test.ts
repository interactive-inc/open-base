import { expect, test } from "bun:test"
import { CompanyEmploymentDependentChangeValue } from "@/contexts/company/domain/values/company-employment-dependent-change.value"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { LifecycleSchedule } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const employeeId = restoreWorkforceId("employee", "employee:one")
const employmentId = restoreWorkforceId("employment", "employment:one")

function schedule(
  endsOn: string | null = "2030-07-01",
  assignmentEndsOn = endsOn,
): LifecycleSchedule {
  const period = {
    periodId: "period:one",
    revision: 1,
    startsOn: "2030-01-01",
    endsOn,
    isVoid: false,
    recordedByActionId: "action:one",
    recordedAt: 1,
  }
  return {
    employments: [{ ...period, employeeId, employmentId }],
    assignments: [
      {
        ...period,
        endsOn: assignmentEndsOn,
        employeeId,
        employmentPeriodId: employmentId,
        organizationUnitId: restoreWorkforceId(
          "organization_unit",
          "0190005f-0000-7000-8000-c9ae95875c9c",
        ),
        departmentCode: "TEAM",
        assignmentType: "primary",
        positionTitle: null,
        managerEmployeeId: null,
      },
    ],
    statuses: [],
    responsibilities: [],
  }
}

function version(
  revision: number,
  start = "2030-03-01",
  holder = employeeId,
  type: "office-assignment" | "organizational-authority" = "office-assignment",
) {
  const resource = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type,
    id: "appointment:one",
    revision,
    state: "active",
    effectiveFrom: restoreCalendarDate(start),
    effectiveTo: null,
    attributes:
      type === "office-assignment"
        ? { employeeId: holder, employmentId, organizationalOfficeId: "office:one" }
        : {
            employeeId: holder,
            employmentId,
            scopeType: "organization-unit",
            scopeId: "0190005f-0000-7000-8000-c9ae95875c9c",
            authority: "APPROVE",
          },
  })
  if (resource instanceof Error) throw resource
  return resource
}

function change(
  history: ReadonlyArray<CompanyResourceEntity>,
  basis = history,
  periods = schedule(),
) {
  const changed = CompanyEmploymentDependentChangeValue.create({
    employeeId,
    history,
    basis,
    schedule: periods,
  })
  if (changed instanceof Error) throw changed
  return changed.resources
}

test("退職は対象者の予約だけを閉じ、将来の別任用を維持する", () => {
  const history = [
    version(1),
    version(2, "2030-09-01", restoreWorkforceId("employee", "employee:two")),
    version(3, "2030-11-01"),
  ]
  expect(
    change(history).map((resource) => [
      String(resource.effectiveFrom),
      resource.effectiveTo?.toString() ?? null,
      resource.state,
    ]),
  ).toEqual([
    ["2030-07-01", "2030-09-01", "void"],
    ["2030-11-01", null, "void"],
  ])
})

test("退職日の訂正は元の任用を新しい終了日まで復元する", () => {
  const original = [version(1)]
  const history = [...original, ...change(original)]
  expect(
    change(history, original, schedule("2030-08-01")).map((resource) => [
      String(resource.effectiveFrom),
      resource.effectiveTo?.toString() ?? null,
      resource.state,
    ]),
  ).toEqual([["2030-07-01", "2030-08-01", "active"]])
})

test("再入社で終了済みの任用を復活させない", () => {
  const original = [version(1)]
  const history = [...original, ...change(original)]
  const periods = schedule()
  const previous = periods.employments[0]
  if (previous === undefined) throw new Error("employment missing")
  expect(
    change(history, history, {
      ...periods,
      employments: [
        ...periods.employments,
        {
          ...previous,
          employmentId: restoreWorkforceId("employment", "employment:two"),
          startsOn: "2030-09-01",
          endsOn: null,
        },
      ],
    }),
  ).toEqual([])
})

test("所属終了は同じ雇用の組織別決裁資格を閉じ、任用を推測で終了しない", () => {
  const authority = [version(1, "2030-03-01", employeeId, "organizational-authority")]
  expect(
    change(authority, authority, schedule(null, "2030-06-01")).map((resource) => [
      String(resource.effectiveFrom),
      resource.state,
    ]),
  ).toEqual([["2030-06-01", "void"]])
  const office = [version(1)]
  expect(change(office, office, schedule(null, "2030-06-01"))).toEqual([])
})

test("無効な期間と履歴の欠落を拒否する", () => {
  const history = [version(2)]
  expect(
    CompanyEmploymentDependentChangeValue.create({
      employeeId,
      history,
      basis: history,
      schedule: schedule(),
    }),
  ).toBeInstanceOf(Error)
  const valid = [version(1)]
  expect(
    CompanyEmploymentDependentChangeValue.create({
      employeeId,
      history: valid,
      basis: valid,
      schedule: schedule("invalid"),
    }),
  ).toBeInstanceOf(Error)
})
