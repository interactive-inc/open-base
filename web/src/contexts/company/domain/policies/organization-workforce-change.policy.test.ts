import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import {
  OrganizationWorkforceChangeEntity,
  type OrganizationWorkforceChangeProps,
} from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import { OrganizationStructureValue } from "@/contexts/company/domain/values/organization-structure.value"
import { OrganizationChangeValidationError } from "@/contexts/company/domain/errors"
import { applyOrganizationWorkforceChange } from "@/contexts/company/domain/policies/organization-workforce-change.policy"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"

const asOf = restoreCalendarDate("2026-01-01")
const operationId = restoreWorkforceId(
  "personnel_action",
  testLiteralId("action:organization-change"),
)
const organizationUnitId = restoreWorkforceId("organization_unit", testLiteralId("company"))

function change(
  overrides: Partial<OrganizationWorkforceChangeProps> = {},
): OrganizationWorkforceChangeEntity {
  const restored = OrganizationWorkforceChangeEntity.restore({
    operationId,
    expectedRevision: 0,
    asOf,
    recordedAt: 10,
    actorAccountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
    reason: "Create company root",
    evidenceReferences: [],
    organizationUnits: [{ id: organizationUnitId, createdAt: 10 }],
    unitPeriods: [
      {
        periodId: restoreWorkforceId("period", testLiteralId("period:company")),
        revision: 1,
        organizationUnitId,
        code: "ROOT",
        officialName: "Company",
        kind: "COMPANY",
        parentOrganizationUnitId: null,
        startsOn: asOf,
        endsOn: null,
        isVoid: false,
        recordedByActionId: operationId,
        recordedAt: 10,
      },
    ],
    assignments: [],
    responsibilities: [],
    ...overrides,
  })
  if (!(restored instanceof OrganizationWorkforceChangeEntity)) throw restored
  return restored
}

function organization() {
  const restored = OrganizationStructureValue.restore({ revision: 0, asOf, units: [] })
  if (!(restored instanceof OrganizationStructureValue)) throw restored
  return restored
}

describe("applyOrganizationWorkforceChange", () => {
  test("Change・組織・Workforceを横断し、次の整合したrevisionを返す", () => {
    const result = applyOrganizationWorkforceChange(change(), organization(), [])

    expect(result).not.toBeInstanceOf(OrganizationChangeValidationError)
    if (result instanceof OrganizationChangeValidationError) return
    expect(result.organization.revision).toBe(1)
    expect(result.organization.units).toHaveLength(1)
    expect(result.schedules).toEqual([])
  })

  test("既存または新規のどちらにもない組織identityを参照する変更を拒否する", () => {
    const unknownId = restoreWorkforceId("organization_unit", testLiteralId("unknown"))
    const result = applyOrganizationWorkforceChange(
      change({
        organizationUnits: [],
        unitPeriods: [
          {
            ...change().unitPeriods[0]!,
            organizationUnitId: unknownId,
          },
        ],
      }),
      organization(),
      [],
    )

    expect(result).toEqual(expect.objectContaining({ code: "invalid_identity" }))
  })
})
