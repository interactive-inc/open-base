import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { describe, expect, test } from "bun:test"
import { validateWorkforceManagers } from "@/contexts/company/domain/policies/validate-workforce-managers.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import type {
  OrgAssignmentPeriod,
  WorkforceLifecycleSchedule,
} from "@/contexts/company/domain/definitions/workforce-schedule.definition"

function employee(name: string): EmployeeId {
  return restoreWorkforceId("employee", testLiteralId(`employee-${name}`))
}

function period(id: string) {
  return {
    periodId: restoreWorkforceId("period", testLiteralId(id)),
    revision: 1,
    startsOn: restoreCalendarDate("2026-01-01"),
    endsOn: null,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", testLiteralId("action-fixture")),
    recordedAt: 1,
  }
}

/** 上長ごとに別の組織単位への所属を持つ、在籍中の従業員を作る。先頭が主所属で残りは兼務になる。 */
function schedule(
  employeeId: EmployeeId,
  managerEmployeeIds: ReadonlyArray<EmployeeId | null>,
): WorkforceLifecycleSchedule {
  const employmentId = restoreWorkforceId("employment", testLiteralId(`employment-${employeeId}`))
  return {
    employeeId,
    employments: [{ ...period(`employment-${employeeId}`), employmentId, employeeId }],
    statuses: [{ ...period(`status-${employeeId}`), employmentId, employeeId, status: "ACTIVE" }],
    assignments: managerEmployeeIds.map(
      (managerEmployeeId, index): OrgAssignmentPeriod => ({
        ...period(`assignment-${employeeId}-${index}`),
        employmentId,
        employeeId,
        organizationUnitId: restoreWorkforceId("organization_unit", testLiteralId(`unit-${index}`)),
        assignmentType: index === 0 ? "PRIMARY" : "CONCURRENT",
        positionTitle: null,
        managerEmployeeId,
      }),
    ),
    responsibilities: [],
  }
}

/**
 * 各階層の2人が、次の階層の2人をどちらも上長に持つ組織を作る。最上階の2人に上長はいない。
 * 循環は無いが、最下階から最上階への経路は階層ごとに倍になる。
 */
function branchingSchedules(levels: number): WorkforceLifecycleSchedule[] {
  return Array.from({ length: levels + 1 }, (_, level) => level).flatMap((level) => {
    const managers =
      level === levels ? [null] : [employee(`a-${level + 1}`), employee(`b-${level + 1}`)]
    return [schedule(employee(`a-${level}`), managers), schedule(employee(`b-${level}`), managers)]
  })
}

describe("validateWorkforceManagers", () => {
  test("兼務で上長が分岐して再び合流する、循環の無い組織を受理する", () => {
    expect(validateWorkforceManagers(branchingSchedules(4))).toBeNull()
  })

  test("分岐して再び合流する組織の最上階から最下階へ戻る循環を拒否する", () => {
    const schedules = branchingSchedules(4)
    schedules[schedules.length - 1] = schedule(employee("b-4"), [employee("a-0")])
    expect(validateWorkforceManagers(schedules)).toEqual(
      expect.objectContaining({ code: "manager_cycle" }),
    )
  })

  test("自己参照と、つながっていない部分にある循環を拒否する", () => {
    expect(validateWorkforceManagers([schedule(employee("self"), [employee("self")])])).toEqual(
      expect.objectContaining({ code: "manager_cycle" }),
    )
    expect(
      validateWorkforceManagers([
        schedule(employee("leader"), [null]),
        schedule(employee("member"), [employee("leader")]),
        schedule(employee("first"), [employee("second")]),
        schedule(employee("second"), [employee("first")]),
      ]),
    ).toEqual(expect.objectContaining({ code: "manager_cycle" }))
  })

  test("同じ上長を主所属と兼務の両方で持つ従業員を循環として扱わない", () => {
    expect(
      validateWorkforceManagers([
        schedule(employee("leader"), [null]),
        schedule(employee("member"), [employee("leader"), employee("leader")]),
      ]),
    ).toBeNull()
  })

  test("経路の数が階層ごとに倍になる循環の無い組織を、経路を列挙せずに検査する", () => {
    // 24 段は、経路を列挙する実装なら十数秒かかって時間切れで落ちる大きさ。もっと深くすると、退行したときに
    // テストが落ちずにプロセスが止まったままになる（同期の計算は時間切れで中断できない）。
    const schedules = branchingSchedules(24)
    expect(validateWorkforceManagers(schedules)).toBeNull()
    schedules[schedules.length - 1] = schedule(employee("b-24"), [employee("a-0")])
    expect(validateWorkforceManagers(schedules)).toEqual(
      expect.objectContaining({ code: "manager_cycle" }),
    )
  }, 5_000)
})
