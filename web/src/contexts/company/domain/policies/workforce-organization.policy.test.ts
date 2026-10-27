import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { describe, expect, test } from "bun:test"
import {
  OrganizationStructureValue,
  type OrganizationUnitPeriod,
} from "@/contexts/company/domain/values/organization-structure.value"
import {
  WorkforceScheduleEntity,
  type EmploymentPeriod,
  type OrgAssignmentPeriod,
  type WorkforceScheduleProps,
} from "@/contexts/company/domain/entities/workforce-schedule.entity"
import { validateWorkforceOrganization } from "@/contexts/company/domain/policies/workforce-organization.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"

const managerId = restoreWorkforceId("employee", testLiteralId("employee-manager"))
const memberId = restoreWorkforceId("employee", testLiteralId("employee-member"))
const rootUnitId = restoreWorkforceId("organization_unit", testLiteralId("unit-root"))
const concurrentUnitId = restoreWorkforceId("organization_unit", testLiteralId("unit-concurrent"))

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

function schedule(
  employeeId: typeof managerId,
  managerEmployeeId: typeof managerId | null,
  accountId: string,
  concurrentManagerEmployeeId: typeof managerId | null = null,
): WorkforceScheduleEntity {
  const employment: EmploymentPeriod = {
    ...period(`employment-${employeeId}`),
    employmentId: restoreWorkforceId("employment", testLiteralId(`employment-${employeeId}`)),
    employeeId,
  }
  const primaryAssignment: OrgAssignmentPeriod = {
    ...period(`assignment-${employeeId}`),
    employmentId: employment.employmentId,
    employeeId,
    organizationUnitId: rootUnitId,
    assignmentType: "PRIMARY",
    positionTitle: null,
    managerEmployeeId,
  }
  const concurrentAssignment: OrgAssignmentPeriod = {
    ...period(`concurrent-assignment-${employeeId}`),
    employmentId: employment.employmentId,
    employeeId,
    organizationUnitId: concurrentUnitId,
    assignmentType: "CONCURRENT",
    positionTitle: null,
    managerEmployeeId: concurrentManagerEmployeeId,
  }
  const props: WorkforceScheduleProps = {
    employee: {
      id: employeeId,
      officialName: `Employee ${employeeId}`,
      employeeCode: null,
      email: null,
      phone: null,
    },
    employments: [employment],
    statuses: [
      {
        ...period(`status-${employeeId}`),
        employmentId: employment.employmentId,
        employeeId,
        status: "ACTIVE",
      },
    ],
    assignments:
      concurrentManagerEmployeeId === null
        ? [primaryAssignment]
        : [primaryAssignment, concurrentAssignment],
    responsibilities: [],
    accountLink: {
      accountId: restoreWorkforceId("system_account", testLiteralId(accountId)),
      employeeId,
    },
  }
  const restored = WorkforceScheduleEntity.restore(props)
  if (!(restored instanceof WorkforceScheduleEntity)) throw new Error(restored.code)
  return restored
}

function organization(): OrganizationStructureValue {
  const unit: OrganizationUnitPeriod = {
    ...period("organization-root"),
    organizationUnitId: rootUnitId,
    code: "ROOT",
    officialName: "Company",
    kind: "COMPANY",
    parentOrganizationUnitId: null,
  }
  const concurrentUnit: OrganizationUnitPeriod = {
    ...period("organization-concurrent"),
    organizationUnitId: concurrentUnitId,
    code: "CONCURRENT",
    officialName: "Concurrent",
    kind: "DEPARTMENT",
    parentOrganizationUnitId: rootUnitId,
  }
  const restored = OrganizationStructureValue.restore({
    revision: 1,
    asOf: restoreCalendarDate("2026-06-01"),
    units: [unit, concurrentUnit],
  })
  if (!(restored instanceof OrganizationStructureValue)) throw new Error(restored.code)
  return restored
}

function employee(name: string): typeof managerId {
  return restoreWorkforceId("employee", testLiteralId(`employee-${name}`))
}

/**
 * 各階層の2人が、次の階層の2人を主所属と兼務の上長に持つ組織を作る。最上階の2人に上長はいない。
 * 循環は無いが、最下階から最上階への経路は階層ごとに倍になる。
 */
function branchingSchedules(levels: number): WorkforceScheduleEntity[] {
  return Array.from({ length: levels + 1 }, (_, level) => level).flatMap((level) => {
    const primary = level === levels ? null : employee(`a-${level + 1}`)
    const concurrent = level === levels ? null : employee(`b-${level + 1}`)
    return [
      schedule(employee(`a-${level}`), primary, `account-a-${level}`, concurrent),
      schedule(employee(`b-${level}`), primary, `account-b-${level}`, concurrent),
    ]
  })
}

describe("validateWorkforceOrganization", () => {
  test("組織内の有効な上長関係と一意なSystem Accountを受理する", () => {
    expect(
      validateWorkforceOrganization({
        schedules: [
          schedule(managerId, null, "account-manager"),
          schedule(memberId, managerId, "account-member"),
        ],
        organization: organization(),
      }),
    ).toBeNull()
  })

  test("循環する上長関係を拒否する", () => {
    expect(
      validateWorkforceOrganization({
        schedules: [
          schedule(managerId, memberId, "account-manager"),
          schedule(memberId, managerId, "account-member"),
        ],
        organization: organization(),
      }),
    ).toEqual(expect.objectContaining({ code: "manager_cycle" }))
  })

  test("重複したSystem Account linkを拒否する", () => {
    expect(
      validateWorkforceOrganization({
        schedules: [
          schedule(managerId, null, "shared-account"),
          schedule(memberId, managerId, "shared-account"),
        ],
        organization: organization(),
      }),
    ).toEqual(expect.objectContaining({ code: "duplicate_account_link" }))
  })

  test("兼務で上長が分岐して再び合流する、循環の無い組織を受理する", () => {
    expect(
      validateWorkforceOrganization({
        schedules: branchingSchedules(4),
        organization: organization(),
      }),
    ).toBeNull()
  })

  test("分岐して再び合流する組織の最上階から最下階へ戻る循環を拒否する", () => {
    const schedules = branchingSchedules(4)
    schedules[schedules.length - 1] = schedule(employee("b-4"), employee("a-0"), "account-b-4")
    expect(validateWorkforceOrganization({ schedules, organization: organization() })).toEqual(
      expect.objectContaining({ code: "manager_cycle" }),
    )
  })

  test("つながっていない部分にある循環を拒否する", () => {
    expect(
      validateWorkforceOrganization({
        schedules: [
          schedule(managerId, null, "account-manager"),
          schedule(memberId, managerId, "account-member"),
          schedule(employee("first"), employee("second"), "account-first"),
          schedule(employee("second"), managerId, "account-second", employee("first")),
        ],
        organization: organization(),
      }),
    ).toEqual(expect.objectContaining({ code: "manager_cycle" }))
  })

  test("同じ上長を主所属と兼務の両方で持つ従業員を循環として扱わない", () => {
    expect(
      validateWorkforceOrganization({
        schedules: [
          schedule(managerId, null, "account-manager"),
          schedule(memberId, managerId, "account-member", managerId),
        ],
        organization: organization(),
      }),
    ).toBeNull()
  })

  test("経路の数が階層ごとに倍になる循環の無い組織を、経路を列挙せずに検査する", () => {
    // 24 段は、経路を列挙する実装なら十数秒かかって時間切れで落ちる大きさ。もっと深くすると、退行したときに
    // テストが落ちずにプロセスが止まったままになる（同期の計算は時間切れで中断できない）。
    const schedules = branchingSchedules(24)
    expect(validateWorkforceOrganization({ schedules, organization: organization() })).toBeNull()
    schedules[schedules.length - 1] = schedule(employee("b-24"), employee("a-0"), "account-b-30")
    expect(validateWorkforceOrganization({ schedules, organization: organization() })).toEqual(
      expect.objectContaining({ code: "manager_cycle" }),
    )
  }, 5_000)
})
