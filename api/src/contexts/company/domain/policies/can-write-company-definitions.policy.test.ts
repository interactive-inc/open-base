import { describe, expect, test } from "bun:test"
import type { CompanyPermissionKey } from "@/contexts/company/domain/catalogs/iam/company-permission-key.catalog"
import type { CompanyResourceType } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { canWriteCompanyDefinitions } from "@/contexts/company/domain/policies/can-write-company-definitions.policy"
import {
  CompanyActorValue,
  type CompanyCapability,
} from "@/contexts/company/domain/values/company-actor.value"

function actor(
  capabilities: ReadonlyArray<CompanyCapability>,
  permissions: ReadonlyArray<CompanyPermissionKey>,
): CompanyActorValue {
  return CompanyActorValue.restore({
    accountId: "4a6f1c2e-8b3d-4e5f-9a0b-1c2d3e4f5a6b",
    employeeId: null,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities,
    permissions,
  })
}

const organizationDefinitionTypes: ReadonlyArray<CompanyResourceType> = [
  "site",
  "workplace",
  "job",
  "organizational-office",
  "responsibility",
  "authority-scope",
  "collective-body",
]

describe("canWriteCompanyDefinitions", () => {
  test("会社全体の変更資格と従業員の編集だけでは、どの定義も書き込めない", () => {
    const employeeEditor = actor(["company:read", "company:write"], ["employee:write"])

    for (const type of [...organizationDefinitionTypes, "grade", "position"] as const) {
      expect(canWriteCompanyDefinitions(employeeEditor, [type])).toBe(false)
    }
  })

  test("組織の定義は組織かマスタの編集で書き込める", () => {
    for (const permission of ["org:write", "master:org:write"] as const) {
      const editor = actor(["company:write"], [permission])

      for (const type of organizationDefinitionTypes) {
        expect(canWriteCompanyDefinitions(editor, [type])).toBe(true)
      }
      expect(canWriteCompanyDefinitions(editor, ["grade"])).toBe(false)
      expect(canWriteCompanyDefinitions(editor, ["position"])).toBe(false)
    }
  })

  test("等級と役職はそれぞれのマスタの編集だけで書き込める", () => {
    expect(canWriteCompanyDefinitions(actor([], ["master:grade:write"]), ["grade"])).toBe(true)
    expect(canWriteCompanyDefinitions(actor([], ["master:position:write"]), ["position"])).toBe(
      true,
    )
    expect(canWriteCompanyDefinitions(actor([], ["master:grade:write"]), ["position"])).toBe(false)
  })

  test("書き込むすべての種別の権限を要求する", () => {
    const gradeEditor = actor(["company:write"], ["master:grade:write"])

    expect(canWriteCompanyDefinitions(gradeEditor, ["grade", "site"])).toBe(false)
    expect(
      canWriteCompanyDefinitions(actor(["company:write"], ["org:write", "master:grade:write"]), [
        "grade",
        "site",
      ]),
    ).toBe(true)
  })

  test("管理者はすべての定義を書き込める", () => {
    const admin = actor(["company:admin"], [])

    expect(
      canWriteCompanyDefinitions(admin, [...organizationDefinitionTypes, "grade", "position"]),
    ).toBe(true)
  })

  test("種別が空、または定義でない種別は拒否する", () => {
    const editor = actor(["company:write"], ["org:write", "employee:write"])

    expect(canWriteCompanyDefinitions(editor, [])).toBe(false)
    expect(canWriteCompanyDefinitions(editor, ["employee"])).toBe(false)
  })
})
