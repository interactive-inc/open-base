import { describe, expect, test } from "bun:test"
import type { CompanyPermissionKey } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import {
  companyResourceTypes,
  type CompanyResourceType,
} from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { canApplyOrganizationChange } from "@/contexts/company/domain/policies/can-apply-organization-change.policy"
import {
  CompanyActorValue,
  type CompanyCapability,
} from "@/contexts/company/domain/values/company-actor.value"

function actor(
  capabilities: ReadonlyArray<CompanyCapability>,
  permissions: ReadonlyArray<CompanyPermissionKey>,
): CompanyActorValue {
  return CompanyActorValue.restore({
    accountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
    employeeId: null,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities,
    permissions,
  })
}

const expectedPermissions: ReadonlyArray<
  readonly [CompanyResourceType, ReadonlyArray<CompanyPermissionKey>]
> = [
  ["legal-entity", ["org:write"]],
  ["company-profile", ["org:write"]],
  ["site", ["org:write"]],
  ["workplace", ["org:write"]],
  ["organization-unit", ["org:write"]],
  ["assignment", ["org:write"]],
  ["reporting-relation", ["org:write"]],
  ["job", ["org:write"]],
  ["organizational-office", ["org:write"]],
  ["office-assignment", ["org:write"]],
  ["responsibility", ["org:write"]],
  ["authority-scope", ["org:write"]],
  ["responsibility-assignment", ["org:write"]],
  ["collective-body", ["org:write"]],
  ["collective-body-membership", ["org:write"]],
  ["organizational-authority", ["org:write"]],
  ["person", ["employee:write"]],
  ["employee", ["employee:write"]],
  ["employment", ["employee:write"]],
  ["grade", ["master:grade:write"]],
  ["position", ["master:position:write"]],
  ["grade-assignment", ["employee:write", "employee:write:attributes"]],
]
const unmappedTypes: ReadonlyArray<CompanyResourceType> = [
  "account-employee-link",
  "personnel-action",
]
const allPermissions: ReadonlyArray<CompanyPermissionKey> = [
  "org:write",
  "master:org:write",
  "master:grade:write",
  "master:position:write",
  "employee:write",
  "employee:write:basic",
  "employee:write:attributes",
  "account_link:write",
]

describe("canApplyOrganizationChange", () => {
  test("すべての資源種別に写像か拒否のどちらかを定める", () => {
    expect(new Set([...expectedPermissions.map(([type]) => type), ...unmappedTypes])).toEqual(
      new Set(companyResourceTypes),
    )
  })

  for (const [type, permissions] of expectedPermissions) {
    test(`${type}はcompany:writeだけでは変更できず、個別権限で変更できる`, () => {
      expect(canApplyOrganizationChange(actor(["company:write"], []), [type])).toBe(false)
      expect(
        canApplyOrganizationChange(
          actor(
            ["company:write"],
            allPermissions.filter((permission) => !permissions.includes(permission)),
          ),
          [type],
        ),
      ).toBe(false)
      for (const permission of permissions) {
        expect(canApplyOrganizationChange(actor(["company:write"], [permission]), [type])).toBe(
          true,
        )
        expect(canApplyOrganizationChange(actor([], [permission]), [type])).toBe(false)
      }
    })
  }

  for (const type of unmappedTypes) {
    test(`${type}は全権限を持っても組織変更では変更できない`, () => {
      expect(canApplyOrganizationChange(actor(["company:write"], allPermissions), [type])).toBe(
        false,
      )
    })
  }

  test("混在する変更はすべての種別の権限を要求する", () => {
    const orgWriter = actor(["company:write"], ["org:write"])
    expect(canApplyOrganizationChange(orgWriter, ["organization-unit", "grade-assignment"])).toBe(
      false,
    )
    expect(
      canApplyOrganizationChange(
        actor(["company:write"], ["org:write", "employee:write:attributes"]),
        ["organization-unit", "grade-assignment"],
      ),
    ).toBe(true)
  })

  test("種別が無い変更は拒否し、company:adminは全写像種別を変更できる", () => {
    const admin = actor(["company:admin"], [])
    expect(canApplyOrganizationChange(admin, [])).toBe(false)
    expect(
      canApplyOrganizationChange(
        admin,
        expectedPermissions.map(([type]) => type),
      ),
    ).toBe(true)
    expect(canApplyOrganizationChange(admin, ["account-employee-link"])).toBe(false)
  })
})
