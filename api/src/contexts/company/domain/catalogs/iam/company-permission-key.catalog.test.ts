import { expect, test } from "bun:test"
import { COMPANY_PERMISSION_KEYS } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import { CompanyPermission } from "@/contexts/company/domain/catalogs/iam/company-permission.catalog"

test("Company権限キーは会社・組織・雇用の語彙だけを持つ", () => {
  expect(COMPANY_PERMISSION_KEYS).toEqual([
    "org:read",
    "org:write",
    "master:org:write",
    "master:grade:write",
    "master:position:write",
    "employee:read",
    "employee:attributes:read",
    "employee:write",
    "employee:write:basic",
    "employee:write:attributes",
  ])
  expect(new Set(COMPANY_PERMISSION_KEYS).size).toBe(COMPANY_PERMISSION_KEYS.length)
  expect(new Set(Object.values(CompanyPermission).map((permission) => permission.key))).toEqual(
    new Set(COMPANY_PERMISSION_KEYS),
  )
})
