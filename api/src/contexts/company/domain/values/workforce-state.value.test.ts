import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { describe, expect, test } from "bun:test"
import { WorkforceStateValue } from "@/contexts/company/domain/values/workforce-state.value"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"

const employeeId = restoreWorkforceId("employee", testLiteralId("employee:1"))

describe("WorkforceStateValue", () => {
  test("雇用前状態を配属のないイミュータブル値として復元する", () => {
    const state = WorkforceStateValue.restore({
      employeeId,
      asOf: restoreCalendarDate("2026-01-01"),
      status: "PRE_HIRE",
      employmentId: null,
      primaryAssignment: null,
      concurrentAssignments: [],
      responsibilities: [],
    })
    expect(state).toBeInstanceOf(WorkforceStateValue)
    if (!(state instanceof WorkforceStateValue)) return
    expect(state.isEligible).toBeFalse()
    expect(state.assignments).toEqual([])
    expect(Object.isFrozen(state)).toBeTrue()
  })

  test("雇用がないのに配属を持つ状態を拒否する", () => {
    const asOf = restoreCalendarDate("2026-01-01")
    expect(
      WorkforceStateValue.restore({
        employeeId,
        asOf,
        status: "PRE_HIRE",
        employmentId: null,
        primaryAssignment: {
          periodId: restoreWorkforceId("period", testLiteralId("assignment:1")),
          revision: 1,
          startsOn: asOf,
          endsOn: null,
          isVoid: false,
          recordedByActionId: restoreWorkforceId("personnel_action", testLiteralId("action:1")),
          recordedAt: 1,
          employmentId: restoreWorkforceId("employment", testLiteralId("employment:1")),
          employeeId,
          organizationUnitId: restoreWorkforceId(
            "organization_unit",
            testLiteralId("0190005f-0000-7000-8000-2fcb85764fe2"),
          ),
          assignmentType: "PRIMARY",
          positionTitle: null,
          managerEmployeeId: null,
        },
        concurrentAssignments: [],
        responsibilities: [],
      }),
    ).toEqual(expect.objectContaining({ code: "invalid_workforce_state" }))
  })
})
