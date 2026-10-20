import { expect, spyOn, test } from "bun:test"
import { drizzle } from "drizzle-orm/d1"
import { DeleteOrganizationUnit } from "@/contexts/company/application/organization/delete-organization-unit"
import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import type { OrganizationUnitPeriod } from "@/contexts/company/domain/definitions/organization-unit.definition"
import type { WorkforceSchedule } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { OrganizationUnitReadAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-unit-read.adapter"
import { OrganizationWorkforceSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/workforce/organization-workforce-snapshot.adapter"
import { OrganizationWorkforceChangeRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-workforce-change.repository"
import { testLiteralId } from "@system/test/system-test-id.test-support"

const AS_OF = restoreCalendarDate("2026-10-12")
const UNIT_ID = restoreWorkforceId("organization_unit", testLiteralId("department"))
const EMPLOYEE_ID = restoreWorkforceId("employee", testLiteralId("employee"))
const EMPLOYMENT_ID = restoreWorkforceId("employment", testLiteralId("employment"))
const ACTION_ID = restoreWorkforceId("personnel_action", testLiteralId("prior-action"))

/** I/Oは全てspyで差し替え、実際の期間検証だけを通す。 */
function unexpectedPersistence(): never {
  throw new Error("unexpected persistence")
}

const binding: D1Database = {
  prepare: unexpectedPersistence,
  batch: unexpectedPersistence,
  exec: unexpectedPersistence,
  dump: unexpectedPersistence,
  withSession: unexpectedPersistence,
}

function period(name: string, startsOn: string, endsOn: string | null = null) {
  return {
    periodId: restoreWorkforceId("period", testLiteralId(name)),
    revision: 1,
    startsOn: restoreCalendarDate(startsOn),
    endsOn: endsOn === null ? null : restoreCalendarDate(endsOn),
    isVoid: false,
    recordedByActionId: ACTION_ID,
    recordedAt: 1,
  }
}

test.each([
  {
    name: "過去の所属",
    hasAssignment: true,
    hasChild: false,
    isCurrent: false,
    startsToday: false,
  },
  {
    name: "過去の子組織",
    hasAssignment: false,
    hasChild: true,
    isCurrent: false,
    startsToday: false,
  },
  { name: "現在の所属", hasAssignment: true, hasChild: false, isCurrent: true, startsToday: false },
  {
    name: "現在の子組織",
    hasAssignment: false,
    hasChild: true,
    isCurrent: true,
    startsToday: false,
  },
  {
    name: "当日開始の期間",
    hasAssignment: false,
    hasChild: false,
    isCurrent: false,
    startsToday: true,
  },
])("組織削除は過去を保ち現在の参照だけ拒否する: $name", async (scenario) => {
  const root: OrganizationUnitPeriod = {
    ...period("root-period", "2020-01-01"),
    organizationUnitId: restoreWorkforceId("organization_unit", testLiteralId("root")),
    code: "ROOT",
    officialName: "Root",
    kind: "COMPANY",
    parentOrganizationUnitId: null,
  }
  const unit: OrganizationUnitPeriod = {
    ...period("department-period", scenario.startsToday ? AS_OF : "2024-04-01"),
    organizationUnitId: UNIT_ID,
    code: "DEPARTMENT",
    officialName: "Department",
    kind: "DEPARTMENT",
    parentOrganizationUnitId: root.organizationUnitId,
  }
  const child: OrganizationUnitPeriod = {
    ...period("child-period", "2024-04-01", scenario.isCurrent ? null : "2025-04-01"),
    organizationUnitId: restoreWorkforceId("organization_unit", testLiteralId("child")),
    code: "CHILD",
    officialName: "Child",
    kind: "TEAM",
    parentOrganizationUnitId: UNIT_ID,
  }
  const snapshot = {
    revision: 1,
    asOf: AS_OF,
    units: [root, unit, ...(scenario.hasChild ? [child] : [])],
  }
  const schedule: WorkforceSchedule = {
    employee: {
      id: EMPLOYEE_ID,
      officialName: "Employee",
      employeeCode: null,
      email: null,
      phone: null,
    },
    employments: [
      {
        ...period("employment", "2024-04-01"),
        employmentId: EMPLOYMENT_ID,
        employeeId: EMPLOYEE_ID,
      },
    ],
    statuses: [
      {
        ...period("status", "2024-04-01"),
        employmentId: EMPLOYMENT_ID,
        employeeId: EMPLOYEE_ID,
        status: "ACTIVE",
      },
    ],
    assignments: [
      {
        ...period("assignment", "2024-04-01", scenario.isCurrent ? null : "2025-04-01"),
        employmentId: EMPLOYMENT_ID,
        employeeId: EMPLOYEE_ID,
        organizationUnitId: UNIT_ID,
        assignmentType: "PRIMARY",
        positionTitle: null,
        managerEmployeeId: null,
      },
    ],
    responsibilities: [],
    accountLink: null,
  }
  const company: CompanyContext = {
    env: { DB: binding, COMPANY_TIME_ZONE: "Asia/Tokyo" },
    var: {
      database: drizzle(binding),
      auditContext: {
        requestId: "request",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  }
  const repository = new OrganizationWorkforceChangeRepository(company)
  const actor = CompanyActorValue.restore({
    accountId: testLiteralId("actor"),
    employeeId: null,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:admin"],
  })
  const find = spyOn(repository, "find").mockResolvedValue(null)
  const read = spyOn(repository, "readSnapshot").mockResolvedValue({ ok: true, snapshot })
  const organization = spyOn(
    OrganizationUnitReadAdapter.prototype,
    "readSnapshot",
  ).mockResolvedValue({ ok: true, snapshot })
  const workforce = spyOn(
    OrganizationWorkforceSnapshotAdapter.prototype,
    "readAllSnapshot",
  ).mockResolvedValue({
    ok: true,
    schedules: scenario.hasAssignment ? [schedule] : [],
  })
  const append = spyOn(repository, "append").mockResolvedValue({
    resultingRevision: 2,
    organizationUnitId: UNIT_ID,
    replayed: false,
  })

  try {
    const deleted = await new DeleteOrganizationUnit({ actor, company, repository }).execute({
      operationId: testLiteralId("delete-action"),
      code: "DEPARTMENT",
      expectedOrganizationRevision: 1,
      expectedAsOf: AS_OF,
      now: new Date("2026-10-12T00:00:00Z"),
    })

    if (scenario.isCurrent) {
      expect(deleted).toBeInstanceOf(CompanyValidationError)
      expect(append).not.toHaveBeenCalled()
      return
    }

    expect(deleted).toEqual({ replayed: false })
    expect(append.mock.calls[0]?.[0].unitPeriods[0]).toMatchObject({
      revision: 2,
      startsOn: unit.startsOn,
      endsOn: scenario.startsToday ? null : AS_OF,
      isVoid: scenario.startsToday,
    })
    expect(snapshot.units[1]).toEqual(unit)
  } finally {
    find.mockRestore()
    read.mockRestore()
    organization.mockRestore()
    workforce.mockRestore()
    append.mockRestore()
  }
})
