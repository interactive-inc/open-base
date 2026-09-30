import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { describe, expect, test } from "bun:test"
import {
  OrganizationStructureValue,
  type OrganizationUnitPeriod,
} from "@/contexts/company/domain/values/organization-structure.value"
import {
  WorkforceScheduleEntity,
  type EmploymentPeriod,
  type WorkforceScheduleProps,
} from "@/contexts/company/domain/entities/workforce-schedule.entity"
import { validateWorkforceOrganization } from "@/contexts/company/domain/policies/workforce-organization.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"

const managerId = restoreWorkforceId("employee", testLiteralId("employee-manager"))
const memberId = restoreWorkforceId("employee", testLiteralId("employee-member"))
const rootUnitId = restoreWorkforceId("organization_unit", testLiteralId("unit-root"))

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
): WorkforceScheduleEntity {
  const employment: EmploymentPeriod = {
    ...period(`employment-${employeeId}`),
    employmentId: restoreWorkforceId("employment", testLiteralId(`employment-${employeeId}`)),
    employeeId,
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
    assignments: [
      {
        ...period(`assignment-${employeeId}`),
        employmentId: employment.employmentId,
        employeeId,
        organizationUnitId: rootUnitId,
        assignmentType: "PRIMARY",
        positionTitle: null,
        managerEmployeeId,
      },
    ],
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
  const restored = OrganizationStructureValue.restore({
    revision: 1,
    asOf: restoreCalendarDate("2026-06-01"),
    units: [unit],
  })
  if (!(restored instanceof OrganizationStructureValue)) throw new Error(restored.code)
  return restored
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
})
