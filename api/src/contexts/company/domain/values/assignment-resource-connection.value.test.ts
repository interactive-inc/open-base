import { expect, test } from "bun:test"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { AssignmentResourceConnectionValue } from "@/contexts/company/domain/values/assignment-resource-connection.value"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import type { OrgAssignmentPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

function resource(overrides: Partial<CompanyResourceProps> = {}) {
  const created = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "assignment",
    id: "existing:assignment",
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2020-01-01"),
    effectiveTo: null,
    attributes: {
      employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
      employmentId: "4b97a400-e084-4aa7-9ec9-c3344438b6c8",
      organizationUnitId: "0190005f-0000-7000-8000-2fcb85764fe2",
      assignmentType: "PRIMARY",
      positionTitle: "Staff",
    },
    ...overrides,
  })
  if (created instanceof Error) throw created
  return created
}

function period(overrides: Partial<OrgAssignmentPeriod> = {}): OrgAssignmentPeriod {
  return {
    periodId: restoreWorkforceId("period", "legacy:1"),
    revision: 1,
    employeeId: restoreWorkforceId("employee", "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1"),
    employmentId: restoreWorkforceId("employment", "4b97a400-e084-4aa7-9ec9-c3344438b6c8"),
    organizationUnitId: restoreWorkforceId(
      "organization_unit",
      "0190005f-0000-7000-8000-2fcb85764fe2",
    ),
    assignmentType: "PRIMARY",
    positionTitle: "Staff",
    managerEmployeeId: null,
    startsOn: restoreCalendarDate("2020-01-01"),
    endsOn: null,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", "record:1"),
    recordedAt: 1,
    ...overrides,
  }
}

test("所属内容が同じ隣接期間を統合し、既存IDと全改訂を保持する", () => {
  const history = [
    resource(),
    resource({ revision: 2, effectiveFrom: restoreCalendarDate("2025-01-01") }),
  ]
  const connected = AssignmentResourceConnectionValue.create({
    history: history.toReversed(),
    periods: [period()],
  })
  if (connected instanceof Error) throw connected
  expect(connected.head).toBe(history[1]!)
  expect(history.map((entry) => entry.revision)).toEqual([1, 2])
})

test("過去の所属内容の違いを、現在の一致で上書きしない", () => {
  const current = resource({ revision: 2, effectiveFrom: restoreCalendarDate("2025-01-01") })
  const changes: ReadonlyArray<CompanyResourceProps["attributes"]> = [
    { employmentId: "3e6eb832-d676-4481-b703-1265880c377e" },
    { organizationUnitId: "0190005f-0000-7000-8000-c81109c4de10" },
    { assignmentType: "CONCURRENT" },
    { positionTitle: "Manager" },
  ]
  for (const changed of changes) {
    const history = [resource({ attributes: { ...resource().attributes, ...changed } }), current]
    expect(
      AssignmentResourceConnectionValue.create({ history, periods: [period()] }),
    ).toBeInstanceOf(Error)
  }
})

test("同じ公開所属内の異動と役職変更を、対応する各期間と照合する", () => {
  const history = [
    resource(),
    resource({
      revision: 2,
      effectiveFrom: restoreCalendarDate("2025-01-01"),
      attributes: {
        ...resource().attributes,
        organizationUnitId: "0190005f-0000-7000-8000-c81109c4de10",
        positionTitle: "Manager",
      },
    }),
  ]
  const periods = [
    period({ endsOn: restoreCalendarDate("2025-01-01") }),
    period({
      periodId: restoreWorkforceId("period", "legacy:2"),
      startsOn: restoreCalendarDate("2025-01-01"),
      organizationUnitId: restoreWorkforceId(
        "organization_unit",
        "0190005f-0000-7000-8000-c81109c4de10",
      ),
      positionTitle: "Manager",
    }),
  ]
  expect(
    AssignmentResourceConnectionValue.create({ history, periods: periods.toReversed() }),
  ).not.toBeInstanceOf(Error)
})

test("過去の開始日・空白・将来終了の相違を補完しない", () => {
  for (const periods of [
    [period({ startsOn: restoreCalendarDate("2021-01-01") })],
    [period({ endsOn: restoreCalendarDate("2030-01-01") })],
    [
      period({ endsOn: restoreCalendarDate("2024-01-01") }),
      period({
        periodId: restoreWorkforceId("period", "legacy:2"),
        startsOn: restoreCalendarDate("2025-01-01"),
      }),
    ],
  ])
    expect(
      AssignmentResourceConnectionValue.create({ history: [resource()], periods }),
    ).toBeInstanceOf(Error)
})

test("将来の取消を期間の終端として扱い、取消前の所属を保全する", () => {
  const history = [
    resource(),
    resource({ revision: 2, state: "void", effectiveFrom: restoreCalendarDate("2030-01-01") }),
  ]
  expect(
    AssignmentResourceConnectionValue.create({
      history,
      periods: [period({ endsOn: restoreCalendarDate("2030-01-01") })],
    }),
  ).not.toBeInstanceOf(Error)
  expect(AssignmentResourceConnectionValue.create({ history, periods: [period()] })).toBeInstanceOf(
    Error,
  )
})

test("履歴欠落・別従業員・重複ID・期間重複を拒否する", () => {
  expect(
    AssignmentResourceConnectionValue.create({
      history: [resource({ revision: 2 })],
      periods: [period()],
    }),
  ).toBeInstanceOf(Error)
  for (const periods of [
    [],
    [period(), period()],
    [period({ employeeId: restoreWorkforceId("employee", "employee:2") })],
    [
      period(),
      period({
        periodId: restoreWorkforceId("period", "legacy:2"),
        startsOn: restoreCalendarDate("2025-01-01"),
      }),
    ],
  ]) {
    expect(
      AssignmentResourceConnectionValue.create({ history: [resource()], periods }),
    ).toBeInstanceOf(Error)
  }
})
