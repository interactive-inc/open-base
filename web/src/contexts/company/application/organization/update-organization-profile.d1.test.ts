import { expect, setDefaultTimeout, spyOn, test } from "bun:test"
import { UpdateOrganizationProfile } from "@/contexts/company/application/organization/update-organization-profile"
import { CompanyForbiddenError } from "@/contexts/company/domain/errors"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { OrganizationProfileChangeRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-profile-change.repository"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("別organizationへのプロフィール変更を保存前に拒否する", async () => {
  const repository = new OrganizationProfileChangeRepository(
    await createLocalD1Database({ schema: "SELECT 1;" }),
  )
  const write = spyOn(OrganizationProfileChangeRepository.prototype, "change")
  const update = new UpdateOrganizationProfile({
    actor: CompanyActorValue.restore({
      accountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
      employeeId: null,
      organizationIds: ["01900060-0000-7000-8000-12268fccf2cc"],
      capabilities: ["company:admin"],
    }),
    repository,
    now: new Date("2026-09-07T03:00:00.000Z"),
    timeZone: "Asia/Tokyo",
  })
  try {
    expect(
      await update.execute({
        commandId: "profile:scope",
        name: "Company",
        representativeName: "Representative",
        locale: "ja-JP",
        timeZone: "Asia/Tokyo",
        fiscalYearStartMonth: 4,
        version: {
          organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
          organizationRevision: 0,
          resourceId: null,
          resourceRevision: 0,
          effectiveOn: "2026-09-07",
          effectiveTo: null,
          sourceFingerprint: "0".repeat(64),
        },
        reason: "Confirmed profile",
      }),
    ).toBeInstanceOf(CompanyForbiddenError)
    expect(write).not.toHaveBeenCalled()
  } finally {
    write.mockRestore()
  }
})
