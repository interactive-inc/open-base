import { InvalidOrganizationResponsibilityTypeError } from "@/contexts/company/domain/errors"
import { restoreOrgResponsibilityType } from "@/contexts/company/domain/definitions/restore-org-responsibility-type.definition"
import { expect, test } from "bun:test"

test("安定した大文字の責任区分を復元する", () => {
  expect(String(restoreOrgResponsibilityType("PEOPLE_OPERATIONS"))).toBe("PEOPLE_OPERATIONS")
})

test("表示ラベルや不正な責任区分の復元を拒否する", () => {
  expect(() => restoreOrgResponsibilityType("people-operations")).toThrow(
    InvalidOrganizationResponsibilityTypeError,
  )
})
