import { testDerivedId } from "@system/test/system-test-id.test-support"
import type { LifecycleSchedule } from "@/contexts/company/domain/definitions/lifecycle-schedule.definition"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { validateLifecycleSchedules } from "@/contexts/company/domain/policies/validate-lifecycle-schedule.policy"
import { describe, expect, test } from "bun:test"
import { projectPersonnelAction } from "@/contexts/company/domain/policies/project-personnel-action.policy"
import { personnelActionInputSchema } from "@/contexts/company/domain/definitions/lifecycle-types.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

function project(initialStatus: "active" | "retired", employmentType: "PART_TIME" | null) {
  const employeeId = restoreWorkforceId("employee", "employee:initial")
  return projectPersonnelAction({
    schedule: { employments: [], statuses: [], assignments: [], responsibilities: [] },
    organizationSchedules: [],
    departments: [],
    employees: [{ id: employeeId, code: "INITIAL" }],
    command: {
      actionId: crypto.randomUUID(),
      employeeId,
      recordedAt: 100,
      input: personnelActionInputSchema.parse({
        kind: "initial_state",
        employeeCode: "INITIAL",
        eventOn: "2026-01-01",
        initialStatus,
        employmentType,
        departmentCode: null,
        positionTitle: null,
        managerEmployeeCode: null,
      }),
    },
  })
}
describe("初期状態の雇用区分", () => {
  test("有効な初期雇用には区分を要求し、その区分で契約を作る", () => {
    expect(project("active", null)).toMatchObject({ code: "personnel_action_invalid_transition" })
    const projected = project("active", "PART_TIME")
    if (projected instanceof Error) throw projected
    expect(projected.newEmploymentType).toBe("PART_TIME")
    expect(projected.schedule.employments).toHaveLength(1)
  })
  test("既に退職した初期状態では区分を捏造せず、契約を作らない", () => {
    const projected = project("retired", null)
    if (projected instanceof Error) throw projected
    expect(projected.newEmploymentType).toBeNull()
    expect(projected.schedule.employments).toHaveLength(0)
    expect(projected.mutations).toHaveLength(0)
  })
})

function fixture() {
  const managerId = restoreWorkforceId("employee", "employee:manager")
  const workerId = restoreWorkforceId("employee", "employee:worker")
  const organizationUnitId = restoreWorkforceId(
    "organization_unit",
    "0190005f-0000-7000-8000-42298cf34a48",
  )
  const schedules = [managerId, workerId].map((employeeId): LifecycleSchedule => {
    const employmentId = restoreWorkforceId("employment", testDerivedId("employment", employeeId))
    const period = {
      revision: 1,
      startsOn: "2030-01-01",
      endsOn: null,
      isVoid: false,
      recordedByActionId: "initial",
      recordedAt: 100,
      employeeId,
    }
    return {
      employments: [{ ...period, periodId: employmentId, employmentId }],
      statuses: [
        {
          ...period,
          periodId: `status:${employeeId}`,
          employmentPeriodId: employmentId,
          status: "active",
        },
      ],
      assignments:
        employeeId === managerId
          ? []
          : [
              {
                ...period,
                periodId: "assignment:worker",
                employmentPeriodId: employmentId,
                organizationUnitId,
                departmentCode: "COMPANY",
                assignmentType: "primary",
                positionTitle: "Member",
                managerEmployeeId: managerId,
              },
            ],
      responsibilities: [],
    }
  })
  const manager = schedules[0]
  const worker = schedules[1]
  if (manager === undefined || worker === undefined) throw new Error("schedule missing")
  const departments: OrganizationUnitPeriod[] = [
    {
      periodId: restoreWorkforceId("period", "period:company"),
      revision: 1,
      startsOn: restoreCalendarDate("2030-01-01"),
      endsOn: null,
      isVoid: false,
      recordedByActionId: restoreWorkforceId("personnel_action", "initial"),
      recordedAt: 100,
      organizationUnitId,
      code: "COMPANY",
      officialName: "Company",
      kind: "COMPANY",
      parentOrganizationUnitId: null,
    },
  ]
  const command: Parameters<typeof projectPersonnelAction>[0]["command"] = {
    actionId: crypto.randomUUID(),
    employeeId: managerId,
    recordedAt: 200,
    input: {
      kind: "retired",
      employeeCode: "MANAGER",
      retirementOn: restoreCalendarDate("2030-06-30"),
    },
  }
  return {
    managerId,
    workerId,
    manager,
    worker,
    props: {
      schedule: manager,
      organizationSchedules: schedules,
      departments,
      employees: [
        { id: managerId, code: "MANAGER" },
        { id: workerId, code: "WORKER" },
      ],
      command,
    },
  }
}

describe("未接続の所属に記録した上長の退職", () => {
  test("部下の所属を保ち、退職翌日から上長だけを外す", () => {
    const context = fixture()
    expect(
      validateLifecycleSchedules({
        schedules: context.props.organizationSchedules,
        departments: context.props.departments,
      }),
    ).toBeUndefined()
    const projected = projectPersonnelAction(context.props)
    expect(projected).not.toBeInstanceOf(Error)
    if (projected instanceof Error) throw projected
    const mutations = projected.mutations.filter((mutation) => mutation.periodType === "assignment")
    expect(mutations.map((mutation) => mutation.after)).toMatchObject([
      {
        periodId: "assignment:worker",
        employeeId: context.workerId,
        startsOn: "2030-01-01",
        endsOn: "2030-07-01",
        managerEmployeeId: context.managerId,
        positionTitle: "Member",
      },
      {
        employeeId: context.workerId,
        startsOn: "2030-07-01",
        endsOn: null,
        managerEmployeeId: null,
        positionTitle: "Member",
      },
    ])
    expect(projected.schedule.assignments).toHaveLength(0)
    expect(projected.affectsOrganization).toBe(true)
    expect(context.worker.assignments[0]?.endsOn).toBeNull()
    expect(context.manager.employments[0]?.endsOn).toBeNull()
  })

  test("元の雇用終端以後に確認済みの再雇用と上長指定を保ち、短縮した空白だけを外す", () => {
    const context = fixture()
    const originalEmployment = context.manager.employments[0]!
    const originalStatus = context.manager.statuses[0]!
    const futureEmploymentId = restoreWorkforceId("employment", "employment:confirmed-rehire")
    const manager: LifecycleSchedule = {
      ...context.manager,
      employments: [
        { ...originalEmployment, endsOn: "2031-01-01" },
        {
          ...originalEmployment,
          periodId: futureEmploymentId,
          employmentId: futureEmploymentId,
          startsOn: "2031-01-01",
        },
      ],
      statuses: [
        { ...originalStatus, endsOn: "2031-01-01" },
        {
          ...originalStatus,
          periodId: "status:confirmed-rehire",
          employmentPeriodId: futureEmploymentId,
          startsOn: "2031-01-01",
        },
      ],
    }
    const schedules = [manager, context.worker]
    expect(
      validateLifecycleSchedules({ schedules, departments: context.props.departments }),
    ).toBeUndefined()
    const projected = projectPersonnelAction({
      ...context.props,
      schedule: manager,
      organizationSchedules: schedules,
    })
    if (projected instanceof Error) throw projected
    expect(
      projected.mutations
        .filter((mutation) => mutation.periodType === "assignment")
        .map((mutation) => [
          mutation.after.startsOn,
          mutation.after.endsOn,
          mutation.after.managerEmployeeId,
        ]),
    ).toEqual([
      ["2030-01-01", "2030-07-01", context.managerId],
      ["2030-07-01", "2031-01-01", null],
      ["2031-01-01", null, context.managerId],
    ])
    expect(projected.schedule.employments[1]).toEqual(manager.employments[1])
  })

  test("退職日までに終了する所属には新しい版を作らない", () => {
    const context = fixture()
    const worker: LifecycleSchedule = {
      ...context.worker,
      assignments: context.worker.assignments.map((period) => ({
        ...period,
        endsOn: "2030-07-01",
      })),
    }
    const projected = projectPersonnelAction({
      ...context.props,
      organizationSchedules: [context.manager, worker],
    })
    if (projected instanceof Error) throw projected
    expect(projected.mutations.filter((mutation) => mutation.periodType === "assignment")).toEqual(
      [],
    )
    expect(projected.affectsOrganization).toBe(false)
  })

  test("退職後に開始する兼務の開始・終了・役職を維持し、上長だけを外す", () => {
    const context = fixture()
    const worker: LifecycleSchedule = {
      ...context.worker,
      assignments: context.worker.assignments.map((period) => ({
        ...period,
        assignmentType: "concurrent",
        startsOn: "2030-09-01",
        endsOn: "2031-01-01",
      })),
    }
    const projected = projectPersonnelAction({
      ...context.props,
      organizationSchedules: [context.manager, worker],
    })
    if (projected instanceof Error) throw projected
    expect(
      projected.mutations
        .filter((mutation) => mutation.periodType === "assignment")
        .map((mutation) => mutation.after),
    ).toEqual([
      {
        ...worker.assignments[0],
        revision: 2,
        managerEmployeeId: null,
        recordedByActionId: context.props.command.actionId,
        recordedAt: context.props.command.recordedAt,
      },
    ])
  })

  test("別上長への将来の交代を保全する", () => {
    const context = fixture()
    const managerId = restoreWorkforceId("employee", "employee:future-manager")
    const employmentId = restoreWorkforceId("employment", "employment:future-manager")
    const manager: LifecycleSchedule = {
      ...context.manager,
      employments: context.manager.employments.map((period) => ({
        ...period,
        periodId: employmentId,
        employmentId,
        employeeId: managerId,
      })),
      statuses: context.manager.statuses.map((period) => ({
        ...period,
        periodId: "status:future-manager",
        employmentPeriodId: employmentId,
        employeeId: managerId,
      })),
    }
    const assignment = context.worker.assignments[0]!
    const worker: LifecycleSchedule = {
      ...context.worker,
      assignments: [
        { ...assignment, endsOn: "2030-10-01" },
        {
          ...assignment,
          periodId: "assignment:future-manager",
          startsOn: "2030-10-01",
          managerEmployeeId: managerId,
        },
      ],
    }
    const projected = projectPersonnelAction({
      ...context.props,
      organizationSchedules: [context.manager, worker, manager],
      employees: [...context.props.employees, { id: managerId, code: "FUTURE" }],
    })
    if (projected instanceof Error) throw projected
    const assignments = projected.mutations.filter(
      (mutation) => mutation.periodType === "assignment",
    )
    expect(
      assignments.map((mutation) => [
        mutation.after.startsOn,
        mutation.after.endsOn,
        mutation.after.managerEmployeeId,
      ]),
    ).toEqual([
      ["2030-01-01", "2030-07-01", context.managerId],
      ["2030-07-01", "2030-10-01", null],
    ])
    expect(
      assignments.some((mutation) => mutation.after.periodId === "assignment:future-manager"),
    ).toBe(false)
  })
})
