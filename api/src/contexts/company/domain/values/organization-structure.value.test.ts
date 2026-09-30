import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import {
  OrganizationStructureValue,
  type OrganizationUnitPeriod,
} from "@/contexts/company/domain/values/organization-structure.value"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { describe, expect, test } from "bun:test"

const rootId = restoreWorkforceId("organization_unit", testLiteralId("company"))
const divisionId = restoreWorkforceId("organization_unit", testLiteralId("division"))
const teamId = restoreWorkforceId("organization_unit", testLiteralId("team"))

function period(
  overrides: Partial<OrganizationUnitPeriod> &
    Pick<OrganizationUnitPeriod, "organizationUnitId" | "code" | "kind">,
): OrganizationUnitPeriod {
  return {
    periodId: restoreWorkforceId("period", testLiteralId(`period:${overrides.organizationUnitId}`)),
    revision: 1,
    startsOn: restoreCalendarDate("2026-01-01"),
    endsOn: null,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", testLiteralId("action:1")),
    recordedAt: 1,
    officialName: overrides.code,
    parentOrganizationUnitId: null,
    ...overrides,
  }
}

function snapshot(units: ReadonlyArray<OrganizationUnitPeriod>) {
  return {
    revision: 1,
    asOf: restoreCalendarDate("2026-06-01"),
    units,
  }
}

describe("OrganizationStructureValue", () => {
  test("期間で構成された単一rootの階層を受理する", () => {
    const units = [
      period({ organizationUnitId: rootId, code: "ROOT", kind: "COMPANY" }),
      period({
        organizationUnitId: divisionId,
        code: "DEV",
        kind: "DIVISION",
        parentOrganizationUnitId: rootId,
      }),
      period({
        organizationUnitId: teamId,
        code: "API",
        kind: "TEAM",
        parentOrganizationUnitId: divisionId,
      }),
    ]

    const value = snapshot(units)
    expect(OrganizationStructureValue.restore(value)).toBeInstanceOf(OrganizationStructureValue)
  })

  test("同じ時期の複数rootとcode重複を拒否する", () => {
    expect(
      OrganizationStructureValue.restore(
        snapshot([
          period({ organizationUnitId: rootId, code: "ROOT", kind: "COMPANY" }),
          period({ organizationUnitId: divisionId, code: "OTHER", kind: "COMPANY" }),
        ]),
      ),
    ).toEqual({
      code: "organization_unit_overlap",
      message: "company root periods overlap",
    })

    expect(
      OrganizationStructureValue.restore(
        snapshot([
          period({ organizationUnitId: rootId, code: "ROOT", kind: "COMPANY" }),
          period({
            organizationUnitId: divisionId,
            code: "DUPLICATE",
            kind: "DIVISION",
            parentOrganizationUnitId: rootId,
          }),
          period({
            organizationUnitId: teamId,
            code: "DUPLICATE",
            kind: "TEAM",
            parentOrganizationUnitId: rootId,
          }),
        ]),
      ),
    ).toEqual({
      code: "organization_code_overlap",
      message: "organization unit codes overlap",
    })
  })

  test("親の全期間に含まれない子を拒否する", () => {
    expect(
      OrganizationStructureValue.restore(
        snapshot([
          period({
            organizationUnitId: rootId,
            code: "ROOT",
            kind: "COMPANY",
            endsOn: restoreCalendarDate("2026-07-01"),
          }),
          period({
            organizationUnitId: divisionId,
            code: "DEV",
            kind: "DIVISION",
            parentOrganizationUnitId: rootId,
          }),
        ]),
      ),
    ).toEqual({
      code: "parent_not_active",
      message: "parent organization unit is not active for the full child period",
    })
  })

  test("期間の途中だけ発生する循環も拒否する", () => {
    expect(
      OrganizationStructureValue.restore(
        snapshot([
          period({ organizationUnitId: rootId, code: "ROOT", kind: "COMPANY" }),
          period({
            organizationUnitId: divisionId,
            code: "DEV",
            kind: "DIVISION",
            parentOrganizationUnitId: teamId,
          }),
          period({
            organizationUnitId: teamId,
            code: "API",
            kind: "TEAM",
            parentOrganizationUnitId: divisionId,
          }),
        ]),
      ),
    ).toEqual({
      code: "hierarchy_cycle",
      message: "organization hierarchy contains a cycle",
    })
  })

  test("void revisionは現行階層とactive IDに含めない", () => {
    const value = snapshot([
      period({ organizationUnitId: rootId, code: "ROOT", kind: "COMPANY" }),
      period({
        organizationUnitId: divisionId,
        code: "DEV",
        kind: "DIVISION",
        parentOrganizationUnitId: rootId,
        isVoid: true,
      }),
    ])

    const structure = OrganizationStructureValue.restore(value)
    expect(structure).toBeInstanceOf(OrganizationStructureValue)
    if (!(structure instanceof OrganizationStructureValue)) return
    expect(structure.activePeriods.map((unit) => unit.organizationUnitId)).toEqual([rootId])
  })
})
