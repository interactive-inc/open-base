import { CompanyAccountProfileEntity } from "@/contexts/company/domain/entities/company-account-profile.entity"
import { describe, expect, test } from "bun:test"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const ACCOUNT_ID = "11111111-1111-4111-8111-111111111111"

describe("CompanyAccountProfileEntity", () => {
  test("Company表示名を氏名・メール・Account IDの順で確定する", () => {
    expect(
      CompanyAccountProfileEntity.displayNameFromAccount(
        "  介護 花子  ",
        "care@example.test",
        ACCOUNT_ID,
      ),
    ).toBe("介護 花子")
    expect(
      CompanyAccountProfileEntity.displayNameFromAccount("   ", " care@example.test ", ACCOUNT_ID),
    ).toBe("care@example.test")
    expect(CompanyAccountProfileEntity.displayNameFromAccount("", null, ACCOUNT_ID)).toBe(
      ACCOUNT_ID,
    )
  })

  test("表示名を200文字以内へ整え、Entityを不変に保つ", () => {
    const displayName = CompanyAccountProfileEntity.displayNameFromAccount(
      `${"あ".repeat(199)} 続き`,
      null,
      ACCOUNT_ID,
    )
    expect({ length: displayName.length, trimmed: displayName.trim() === displayName }).toEqual({
      length: 199,
      trimmed: true,
    })

    const entity = CompanyAccountProfileEntity.create({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      accountId: ACCOUNT_ID,
      displayName,
      createdAt: new Date(1),
      updatedAt: new Date(1),
    })
    expect(entity).toBeInstanceOf(CompanyAccountProfileEntity)
    expect(Object.isFrozen(entity)).toBeTrue()
  })
})
