import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { CompanyWorkforceIdentityStartCorrectionValue } from "@/contexts/company/domain/values/company-workforce-identity-start-correction.value"
import { describe, expect, test } from "bun:test"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const initial: CompanyResourceProps = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  type: "employee",
  id: "employee:one",
  revision: 1,
  state: "active",
  effectiveFrom: restoreCalendarDate("2020-07-01"),
  effectiveTo: null,
  attributes: { personId: "person:one", employeeCode: "E001" },
}

describe("Person / Employee の開始期間の訂正", () => {
  test("元の資源を消さず、早い開始日と現在の資源を同じ変更で保つ", () => {
    const result = CompanyWorkforceIdentityStartCorrectionValue.create(
      [initial],
      restoreCalendarDate("2020-06-01"),
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.resources).toMatchObject([
      { revision: 2, effectiveFrom: "2020-06-01", attributes: initial.attributes },
    ])
    expect(result.corrections).toEqual([
      { type: "employee", id: "employee:one", revision: 2, correctsRevision: 1 },
    ])
  })

  test("後続の属性変更と現在のheadを保つ", () => {
    const later: CompanyResourceProps = {
      ...initial,
      revision: 2,
      effectiveFrom: restoreCalendarDate("2024-01-01"),
      attributes: { ...initial.attributes, employeeCode: "E002" },
    }
    const result = CompanyWorkforceIdentityStartCorrectionValue.create(
      [initial, later],
      restoreCalendarDate("2020-06-01"),
    )
    expect(result).not.toBeInstanceOf(Error)
    if (result instanceof Error) return
    expect(result.resources).toMatchObject([
      { revision: 3, effectiveFrom: "2020-06-01", attributes: initial.attributes },
      { revision: 4, effectiveFrom: "2024-01-01", attributes: later.attributes },
    ])
    expect(result.corrections.map((correction) => correction.correctsRevision)).toEqual([1, 2])
  })

  test("既に期間が含まれるときは訂正を増やさない", () => {
    const result = CompanyWorkforceIdentityStartCorrectionValue.create(
      [initial],
      restoreCalendarDate("2020-08-01"),
    )
    expect(result).toMatchObject({ resources: [], corrections: [] })
  })
})
