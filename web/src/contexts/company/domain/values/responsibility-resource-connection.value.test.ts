import { testLiteralId } from "@/contexts/system/test/system-test-id.test-support"
import { expect, test } from "bun:test"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { ResponsibilityResourceConnectionValue } from "@/contexts/company/domain/values/responsibility-resource-connection.value"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import type { OrgResponsibilityPeriod } from "@/contexts/company/domain/definitions/workforce-schedule.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const source = {
  employeeId: restoreWorkforceId("employee", testLiteralId("employee:1")),
  employmentId: restoreWorkforceId("employment", testLiteralId("employment:1")),
  organizationUnitId: restoreWorkforceId(
    "organization_unit",
    testLiteralId("0190005f-0000-7000-8000-2fcb85764fe2"),
  ),
  responsibilityType: restoreOrgResponsibilityType("MANAGER"),
  responsibilityId: "responsibility:manager",
  authorityScopeId: "scope:unit",
}

function resource(overrides: Partial<CompanyResourceProps> = {}) {
  const created = CompanyResourceEntity.create({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "responsibility-assignment",
    id: "existing:responsibility",
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2020-01-01"),
    effectiveTo: null,
    attributes: {
      holderType: "employee",
      holderId: source.employeeId,
      responsibilityId: source.responsibilityId,
      authorityScopeId: source.authorityScopeId,
      delegationAllowed: false,
    },
    ...overrides,
  })
  if (created instanceof Error) throw created
  return created
}

function period(overrides: Partial<OrgResponsibilityPeriod> = {}): OrgResponsibilityPeriod {
  return {
    ...source,
    periodId: restoreWorkforceId("period", testLiteralId("legacy:1")),
    revision: 1,
    startsOn: restoreCalendarDate("2020-01-01"),
    endsOn: null,
    isVoid: false,
    recordedByActionId: restoreWorkforceId("personnel_action", testLiteralId("record:1")),
    recordedAt: 1,
    ...overrides,
  }
}

test("明示した既存IDと全revisionを保持し、連続した期間の分割差だけを許す", () => {
  const history = [
    resource(),
    resource({ revision: 2, effectiveFrom: restoreCalendarDate("2025-01-01") }),
  ]
  const connection = ResponsibilityResourceConnectionValue.create({
    source,
    history: history.toReversed(),
    periods: [period()],
  })
  expect(connection).not.toBeInstanceOf(Error)
  if (connection instanceof Error) throw connection
  expect(connection.head).toBe(history[1]!)
  expect(history.map((entry) => entry.revision)).toEqual([1, 2])
})

test("現在が同じでも過去の開始日・空白・将来の終了が異なれば統合しない", () => {
  for (const periods of [
    [period({ startsOn: restoreCalendarDate("2021-01-01") })],
    [
      period({ endsOn: restoreCalendarDate("2024-01-01") }),
      period({
        periodId: restoreWorkforceId("period", testLiteralId("legacy:2")),
        startsOn: restoreCalendarDate("2025-01-01"),
      }),
    ],
    [period({ endsOn: restoreCalendarDate("2030-01-01") })],
  ]) {
    expect(
      ResponsibilityResourceConnectionValue.create({ source, history: [resource()], periods }),
    ).toBeInstanceOf(Error)
  }
})

test("取消済みの将来版も期間の照合に含め、予約を復活させない", () => {
  const history = [
    resource(),
    resource({ revision: 2, state: "void", effectiveFrom: restoreCalendarDate("2030-01-01") }),
  ]
  expect(
    ResponsibilityResourceConnectionValue.create({
      source,
      history,
      periods: [period({ endsOn: restoreCalendarDate("2030-01-01") })],
    }),
  ).not.toBeInstanceOf(Error)
  expect(
    ResponsibilityResourceConnectionValue.create({ source, history, periods: [period()] }),
  ).toBeInstanceOf(Error)
})

test("別雇用・別組織・別責務・委任条件の違いと履歴欠落を拒否する", () => {
  for (const changed of [
    period({ employmentId: restoreWorkforceId("employment", testLiteralId("employment:2")) }),
    period({
      organizationUnitId: restoreWorkforceId(
        "organization_unit",
        testLiteralId("0190005f-0000-7000-8000-c81109c4de10"),
      ),
    }),
    period({ responsibilityType: restoreOrgResponsibilityType("PEOPLE_OPERATIONS") }),
  ]) {
    expect(
      ResponsibilityResourceConnectionValue.create({
        source,
        history: [resource()],
        periods: [changed],
      }),
    ).toBeInstanceOf(Error)
  }
  for (const history of [
    [resource({ revision: 2 })],
    [resource({ attributes: { ...resource().attributes, delegationAllowed: true } })],
    [resource({ attributes: { ...resource().attributes, holderId: "employee:2" } })],
  ]) {
    expect(
      ResponsibilityResourceConnectionValue.create({ source, history, periods: [period()] }),
    ).toBeInstanceOf(Error)
  }
})

test("旧期間の重複・重複ID・空の対象を同一責務と解釈しない", () => {
  for (const periods of [
    [],
    [period(), period()],
    [
      period(),
      period({
        periodId: restoreWorkforceId("period", testLiteralId("legacy:2")),
        startsOn: restoreCalendarDate("2025-01-01"),
      }),
    ],
  ]) {
    expect(
      ResponsibilityResourceConnectionValue.create({ source, history: [resource()], periods }),
    ).toBeInstanceOf(Error)
  }
})
