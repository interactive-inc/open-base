import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import {
  OrganizationWorkforceChangeEntity,
  type OrganizationWorkforceChangeProps,
} from "@/contexts/company/domain/entities/organization-workforce-change.entity"
import { OrganizationChangeValidationError } from "@/contexts/company/domain/errors"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"

const operationId = restoreWorkforceId(
  "personnel_action",
  testLiteralId("action:organization-change"),
)
const organizationUnitId = restoreWorkforceId("organization_unit", testLiteralId("company"))

function props(
  overrides: Partial<OrganizationWorkforceChangeProps> = {},
): OrganizationWorkforceChangeProps {
  return {
    operationId,
    expectedRevision: 0,
    asOf: restoreCalendarDate("2026-01-01"),
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
        startsOn: restoreCalendarDate("2026-01-01"),
        endsOn: null,
        isVoid: false,
        recordedByActionId: operationId,
        recordedAt: 10,
      },
    ],
    assignments: [],
    responsibilities: [],
    ...overrides,
  }
}

describe("OrganizationWorkforceChangeEntity", () => {
  test("一つの操作に属する変更だけを復元し、入力配列から独立して凍結する", () => {
    const input = props()
    const restored = OrganizationWorkforceChangeEntity.restore(input)

    expect(restored).toBeInstanceOf(OrganizationWorkforceChangeEntity)
    if (!(restored instanceof OrganizationWorkforceChangeEntity)) return
    expect(restored.periodCount).toBe(1)
    expect(Object.isFrozen(restored)).toBeTrue()
    expect(Object.isFrozen(restored.unitPeriods)).toBeTrue()
    expect(Object.isFrozen(restored.unitPeriods[0])).toBeTrue()
  })

  test("空変更・操作不一致・監査情報不正・identity重複をそれぞれ拒否する", () => {
    const invalidOperationId = restoreWorkforceId("personnel_action", testLiteralId("action:other"))
    const cases: ReadonlyArray<
      readonly [
        Partial<OrganizationWorkforceChangeProps>,
        OrganizationChangeValidationError["code"],
      ]
    > = [
      [{ unitPeriods: [] }, "empty_change"],
      [
        {
          unitPeriods: [
            {
              ...props().unitPeriods[0]!,
              recordedByActionId: invalidOperationId,
            },
          ],
        },
        "invalid_operation",
      ],
      [{ actorAccountId: " account:1" }, "invalid_audit"],
      [
        {
          organizationUnits: [
            { id: organizationUnitId, createdAt: 10 },
            { id: organizationUnitId, createdAt: 10 },
          ],
        },
        "invalid_identity",
      ],
    ]

    for (const [overrides, code] of cases) {
      expect(OrganizationWorkforceChangeEntity.restore(props(overrides))).toEqual(
        expect.objectContaining({ code }),
      )
    }
  })
})
