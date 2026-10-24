import { describe, expect, test } from "bun:test"
import {
  CompanyResourceEntity,
  type CompanyResourceProps,
} from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const employee = {
  organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
  type: "employee",
  id: "employee:1",
  revision: 1,
  state: "active",
  effectiveFrom: restoreCalendarDate("2026-01-01"),
  effectiveTo: null,
  attributes: { personId: "person:1", employeeCode: "E001" },
} as const satisfies CompanyResourceProps

describe("CompanyResourceEntity", () => {
  test("opaque IDと半開期間を持つイミュータブルEntityを生成する", () => {
    const resource = CompanyResourceEntity.create(employee)
    expect(resource).toBeInstanceOf(CompanyResourceEntity)
    if (!(resource instanceof CompanyResourceEntity)) return

    expect(resource.contains(restoreCalendarDate("2026-06-01"))).toBeTrue()
    expect(resource.readText("personId")).toBe("person:1")
    expect(Object.isFrozen(resource)).toBeTrue()
    expect(Object.isFrozen(resource.attributes)).toBeTrue()
  })

  test("空白を含むIDと逆転期間を拒否する", () => {
    expect(CompanyResourceEntity.create({ ...employee, id: "employee 1" })).toEqual(
      expect.objectContaining({ code: "invalid_identifier" }),
    )
    expect(
      CompanyResourceEntity.create({
        ...employee,
        effectiveTo: restoreCalendarDate("2025-12-31"),
      }),
    ).toEqual(expect.objectContaining({ code: "invalid_period" }))
  })

  test("組織単位resourceを期間モデルへ変換する", () => {
    const resource = CompanyResourceEntity.create({
      ...employee,
      type: "organization-unit",
      id: "01900062-0000-7000-8000-000000000001",
      attributes: {
        organizationUnitId: "01900063-0000-7000-8000-000000000001",
        code: "ROOT",
        officialName: "Company",
        kind: "COMPANY",
        parentOrganizationUnitId: null,
      },
    })
    expect(resource).toBeInstanceOf(CompanyResourceEntity)
    if (!(resource instanceof CompanyResourceEntity)) return

    expect(resource.toOrganizationUnitPeriod()).toEqual(
      expect.objectContaining({
        code: "ROOT",
        kind: "COMPANY",
        parentOrganizationUnitId: null,
      }),
    )
  })

  test("SiteとWorkplaceを型付き属性で検証する", () => {
    const site = CompanyResourceEntity.create({
      ...employee,
      type: "site",
      id: "site:main",
      attributes: {
        code: "MAIN",
        officialName: "Main Site",
        legalEntityId: "legal-entity:primary",
        kind: "physical",
        timeZone: "Asia/Tokyo",
        countryCode: "JP",
      },
    })
    const workplace = CompanyResourceEntity.create({
      ...employee,
      type: "workplace",
      id: "workplace:main-office",
      attributes: {
        code: "MAIN-OFFICE",
        officialName: "Main Office",
        siteId: "site:main",
        kind: "office",
        organizationUnitId: null,
      },
    })

    expect(site).toBeInstanceOf(CompanyResourceEntity)
    expect(workplace).toBeInstanceOf(CompanyResourceEntity)
  })

  test("SiteとWorkplaceの不正な型固有属性を拒否する", () => {
    const invalidSite = CompanyResourceEntity.create({
      ...employee,
      type: "site",
      id: "site:main",
      attributes: {
        code: "main site",
        officialName: "Main Site",
        legalEntityId: "legal-entity:primary",
        kind: "physical",
        timeZone: "local",
        countryCode: "Japan",
      },
    })
    const invalidWorkplace = CompanyResourceEntity.create({
      ...employee,
      type: "workplace",
      id: "workplace:main-office",
      attributes: {
        code: "MAIN-OFFICE",
        officialName: "Main Office",
        siteId: "site main",
        kind: "desk",
      },
    })

    expect(invalidSite).toEqual(expect.objectContaining({ code: "invalid_resource" }))
    expect(invalidWorkplace).toEqual(expect.objectContaining({ code: "invalid_resource" }))
  })

  test("全resourceで未定義属性を受理しない", () => {
    expect(
      CompanyResourceEntity.create({
        ...employee,
        attributes: { ...employee.attributes, arbitrary: "value" },
      }),
    ).toEqual(expect.objectContaining({ code: "invalid_resource" }))
  })

  test("法人と会社文脈を法域・通貨・locale・timezone・会計年度付きで検証する", () => {
    expect(
      CompanyResourceEntity.create({
        ...employee,
        type: "legal-entity",
        id: "legal-entity:primary",
        attributes: {
          officialName: "Example Corporation",
          jurisdictionCountryCode: "US",
          registrationNumber: null,
          defaultCurrencyCode: "USD",
        },
      }),
    ).toBeInstanceOf(CompanyResourceEntity)
    expect(
      CompanyResourceEntity.create({
        ...employee,
        type: "company-profile",
        id: "company-profile:primary",
        attributes: {
          displayName: "Example",
          locale: "en-US",
          timeZone: "America/New_York",
          fiscalYearStartMonth: 1,
        },
      }),
    ).toBeInstanceOf(CompanyResourceEntity)
  })

  test("職務・組織役職・責務scope・合議体を型付きresourceとして検証する", () => {
    const resources: ReadonlyArray<CompanyResourceProps> = [
      {
        ...employee,
        type: "job",
        id: "job:engineer",
        attributes: { code: "ENGINEER", officialName: "Engineer" },
      },
      {
        ...employee,
        type: "organizational-office",
        id: "office:engineering-manager",
        attributes: {
          code: "ENGINEERING_MANAGER",
          officialName: "Engineering Manager",
          organizationUnitId: "organization-unit:engineering",
          positionId: "position:manager",
        },
      },
      {
        ...employee,
        type: "authority-scope",
        id: "authority-scope:budget",
        attributes: {
          scopeType: "amount",
          currencyCode: "USD",
          minimumAmount: 0,
          maximumAmount: 100_000,
        },
      },
      {
        ...employee,
        type: "collective-body",
        id: "collective-body:board",
        attributes: {
          code: "BOARD",
          officialName: "Board",
          quorumType: "percentage",
          quorumValue: 50,
          decisionRule: "majority",
        },
      },
    ]

    expect(
      resources
        .map((resource) => CompanyResourceEntity.create(resource))
        .every((resource) => resource instanceof CompanyResourceEntity),
    ).toBeTrue()
    expect(
      CompanyResourceEntity.create({
        ...resources[2],
        attributes: {
          scopeType: "amount",
          currencyCode: "USD",
          minimumAmount: 101,
          maximumAmount: 100,
        },
      }),
    ).toEqual(expect.objectContaining({ code: "invalid_resource" }))
  })
})
