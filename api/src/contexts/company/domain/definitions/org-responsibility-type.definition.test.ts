import { isOrgResponsibilityType } from "@/contexts/company/domain/definitions/org-responsibility-type.definition"
import { describe, expect, test } from "bun:test"

describe("OrgResponsibilityType", () => {
  test("restores a stable uppercase responsibility code", () => {
    expect(isOrgResponsibilityType("MANAGER")).toBe(true)
  })

  test("rejects display labels and malformed codes", () => {
    expect(isOrgResponsibilityType("people operations")).toBe(false)
  })
})
