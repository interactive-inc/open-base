import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { describe, expect, test } from "bun:test"
import {
  WorkforceScheduleEntity,
  type EmploymentPeriod,
  type EmploymentStatusPeriod,
  type OrgAssignmentPeriod,
  type OrgResponsibilityPeriod,
  type WorkforceScheduleProps,
} from "@/contexts/company/domain/entities/workforce-schedule.entity"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import type { OrgResponsibilityType } from "@/contexts/company/domain/definitions/org-responsibility-type.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"

const employeeId = restoreWorkforceId("employee", testLiteralId("employee-member"))
const unitId = restoreWorkforceId("organization_unit", testLiteralId("unit-root"))

function period(periodId: string, startsOn = "2026-01-01", endsOn: string | null = null) {
  return {
    periodId: restoreWorkforceId("period", testLiteralId(periodId)),
    revision: 1,
    startsOn: restoreCalendarDate(startsOn),
    endsOn: endsOn === null ? null : restoreCalendarDate(endsOn),
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", testLiteralId("action-fixture")),
    recordedAt: 1,
  }
}

function fixture(): WorkforceScheduleProps {
  const employment: EmploymentPeriod = {
    ...period("employment-period"),
    employmentId: restoreWorkforceId("employment", testLiteralId("employment")),
    employeeId,
  }
  const status: EmploymentStatusPeriod = {
    ...period("status-period"),
    employmentId: employment.employmentId,
    employeeId,
    status: "ACTIVE",
  }
  const assignment: OrgAssignmentPeriod = {
    ...period("assignment-period"),
    employmentId: employment.employmentId,
    employeeId,
    organizationUnitId: unitId,
    assignmentType: "PRIMARY",
    positionTitle: null,
    managerEmployeeId: null,
  }
  const responsibility: OrgResponsibilityPeriod = {
    ...period("responsibility-period"),
    employmentId: employment.employmentId,
    employeeId,
    organizationUnitId: unitId,
    responsibilityType: restoreOrgResponsibilityType("MANAGER"),
  }
  return {
    employee: {
      id: employeeId,
      officialName: "Member Example",
      employeeCode: null,
      email: null,
      phone: null,
    },
    employments: [employment],
    statuses: [status],
    assignments: [assignment],
    responsibilities: [responsibility],
    accountLink: null,
  }
}

describe("WorkforceScheduleEntity", () => {
  test("連続した雇用状態・配属・責任をイミュータブルなscheduleへ復元する", () => {
    const schedule = WorkforceScheduleEntity.restore(fixture())
    expect(schedule).toBeInstanceOf(WorkforceScheduleEntity)
    if (!(schedule instanceof WorkforceScheduleEntity)) return

    expect(schedule.isActiveAt(restoreCalendarDate("2026-06-01"))).toBeTrue()
    expect(schedule.findEmployment(schedule.employments[0]!.employmentId)).toEqual(
      schedule.employments[0],
    )
    expect(Object.isFrozen(schedule)).toBeTrue()
    expect(Object.isFrozen(schedule.assignments)).toBeTrue()
  })

  test("雇用期間を覆わない状態期間を拒否する", () => {
    const props = fixture()
    expect(
      WorkforceScheduleEntity.restore({
        ...props,
        statuses: [{ ...props.statuses[0]!, endsOn: restoreCalendarDate("2026-06-01") }],
      }),
    ).toEqual(expect.objectContaining({ code: "status_gap_or_overlap" }))
  })

  test("重複する主配属を拒否する", () => {
    const props = fixture()
    expect(
      WorkforceScheduleEntity.restore({
        ...props,
        assignments: [
          ...props.assignments,
          {
            ...props.assignments[0]!,
            periodId: restoreWorkforceId("period", testLiteralId("assignment-period-2")),
          },
        ],
      }),
    ).toEqual(expect.objectContaining({ code: "primary_assignment_overlap" }))
  })

  test("配属のない責任と不正な責任コードを拒否する", () => {
    const props = fixture()
    expect(WorkforceScheduleEntity.restore({ ...props, assignments: [] })).toEqual(
      expect.objectContaining({ code: "responsibility_without_assignment" }),
    )
    expect(
      WorkforceScheduleEntity.restore({
        ...props,
        responsibilities: [
          {
            ...props.responsibilities[0]!,
            responsibilityType: "people ops" as OrgResponsibilityType,
          },
        ],
      }),
    ).toEqual(expect.objectContaining({ code: "invalid_responsibility" }))
  })

  test("基準日時点の状態をEntity自身が解決する", () => {
    const schedule = WorkforceScheduleEntity.restore(fixture())
    expect(schedule).toBeInstanceOf(WorkforceScheduleEntity)
    if (!(schedule instanceof WorkforceScheduleEntity)) return

    expect(schedule.resolveStateAt(restoreCalendarDate("2026-06-01"))).toEqual(
      expect.objectContaining({
        employeeId,
        status: "ACTIVE",
        primaryAssignment: expect.objectContaining({ organizationUnitId: unitId }),
      }),
    )
  })
})
