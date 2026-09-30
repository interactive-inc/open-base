import { expect, setDefaultTimeout, test } from "bun:test"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { readCompanyEmploymentDirectory } from "@/contexts/company/interface/operations/read-company-employment-directory"
import { readCompanyEmploymentStates } from "@/contexts/company/interface/operations/read-company-employment-states"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("雇用の在籍状態と雇用形態を雇用名簿と同じ Company 版で返す", async () => {
  const fixture = await createGovernanceTaskTestContext()
  const effectiveOn = resolveCompanyBusinessDate({
    now: fixture.at.toISOString(),
    timeZone: "Asia/Tokyo",
  })
  if (effectiveOn instanceof Error) throw effectiveOn

  const directory = await readCompanyEmploymentDirectory({
    database: fixture.database,
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    effectiveOn,
  })
  if (directory instanceof Error) throw directory
  const states = await readCompanyEmploymentStates({
    database: fixture.database,
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    effectiveOn,
    organizationRevision: directory.organizationRevision,
  })
  if (states instanceof Error) throw states

  expect(states.items.length).toBeGreaterThan(0)
  expect(states).toEqual({
    organizationRevision: directory.organizationRevision,
    items: directory.items.map((item) => ({
      employmentId: item.employmentId,
      status: item.status,
      employmentType: item.employmentType,
    })),
  })
})

test("雇用が始まる前の有効日と不正な組織では雇用を補完しない", async () => {
  const fixture = await createGovernanceTaskTestContext()

  const before = await readCompanyEmploymentStates({
    database: fixture.database,
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    effectiveOn: restoreCalendarDate("1900-01-01"),
  })
  if (before instanceof Error) throw before
  expect(before.items).toEqual([])

  expect(
    await readCompanyEmploymentStates({
      database: fixture.database,
      organizationId: "",
      effectiveOn: restoreCalendarDate("2026-01-01"),
    }),
  ).toBeInstanceOf(Error)
})
