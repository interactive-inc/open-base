import { expect, setDefaultTimeout, test } from "bun:test"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { readCompanyEmploymentAccount } from "@/contexts/company/interface/operations/read-company-employment-account"
import { readCompanyEmploymentDirectory } from "@/contexts/company/interface/operations/read-company-employment-directory"
import { readCompanyEmploymentsByAccount } from "@/contexts/company/interface/operations/read-company-employments-by-account"
import { readCompanyEmploymentsByAccounts } from "@/contexts/company/interface/operations/read-company-employments-by-accounts"
import { readCompanyEmploymentsByEmployee } from "@/contexts/company/interface/operations/read-company-employments-by-employee"
import { createGovernanceTaskTestContext } from "@/contexts/company/test/governance-task.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

test("雇用と Account 対応を同じ Company 版で読み、存在しない雇用を補完しない", async () => {
  const fixture = await createGovernanceTaskTestContext()
  const person = fixture.people[1]!
  const effectiveOn = resolveCompanyBusinessDate({
    now: fixture.at.toISOString(),
    timeZone: "Asia/Tokyo",
  })
  if (effectiveOn instanceof Error) throw effectiveOn
  const employments = await readCompanyEmploymentsByEmployee({
    database: fixture.database,
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    employeeIds: [person.employeeId],
    effectiveOn,
  })
  if (employments instanceof Error) throw employments
  const employmentId = employments.employmentIdsByEmployee.get(person.employeeId)?.[0]
  if (employmentId === undefined) throw new Error("employment fixture is missing")

  const found = await readCompanyEmploymentAccount({
    database: fixture.database,
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    employmentId,
    effectiveOn,
    organizationRevision: employments.organizationRevision,
  })
  if (found instanceof Error) throw found
  expect(found).toEqual({
    organizationRevision: employments.organizationRevision,
    employment: {
      employeeId: person.employeeId,
      status: "ACTIVE",
      effectiveTo: null,
      accountId: person.accountId,
    },
  })

  expect(
    await readCompanyEmploymentsByAccount({
      database: fixture.database,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      accountId: person.accountId,
      effectiveOn,
      organizationRevision: found.organizationRevision,
    }),
  ).toEqual({
    organizationRevision: found.organizationRevision,
    employeeId: person.employeeId,
    employmentIds: [employmentId],
    employmentStatusesById: new Map([[employmentId, "ACTIVE"]]),
  })
  expect(
    await readCompanyEmploymentsByAccount({
      database: fixture.database,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      accountId: "edc7ed60-7891-449f-a5fe-4f9e49b81a2a",
      effectiveOn,
      organizationRevision: found.organizationRevision,
    }),
  ).toEqual({
    organizationRevision: found.organizationRevision,
    employeeId: null,
    employmentIds: [],
    employmentStatusesById: new Map(),
  })
  expect(
    await readCompanyEmploymentsByAccounts({
      database: fixture.database,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      accountIds: [person.accountId, "edc7ed60-7891-449f-a5fe-4f9e49b81a2a"],
      effectiveOn,
      organizationRevision: found.organizationRevision,
    }),
  ).toEqual({
    organizationRevision: found.organizationRevision,
    employeeIdsByAccount: new Map([[person.accountId, person.employeeId]]),
    employmentIdsByAccount: new Map([
      [person.accountId, [employmentId]],
      ["edc7ed60-7891-449f-a5fe-4f9e49b81a2a", []],
    ]),
    employmentStatusesById: new Map([[employmentId, "ACTIVE"]]),
  })
  expect(
    await readCompanyEmploymentsByAccounts({
      database: fixture.database,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      accountIds: [],
      effectiveOn,
    }),
  ).toBeInstanceOf(Error)

  const directory = await readCompanyEmploymentDirectory({
    database: fixture.database,
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    effectiveOn,
    organizationRevision: found.organizationRevision,
  })
  if (directory instanceof Error) throw directory
  expect(directory.items.find((item) => item.employmentId === employmentId)).toMatchObject({
    employeeId: person.employeeId,
    personName: expect.any(String),
    accountId: person.accountId,
    status: "ACTIVE",
  })

  const missing = await readCompanyEmploymentAccount({
    database: fixture.database,
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    employmentId: "8a156d98-3a3a-4e8e-a0cf-ca53b913fd4a",
    effectiveOn,
    organizationRevision: found.organizationRevision,
  })
  expect(missing).toEqual({
    organizationRevision: found.organizationRevision,
    employment: null,
  })

  const beforeHire = await readCompanyEmploymentAccount({
    database: fixture.database,
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    employmentId,
    effectiveOn: restoreCalendarDate("1900-01-01"),
    organizationRevision: found.organizationRevision,
  })
  expect(beforeHire).toEqual({
    organizationRevision: found.organizationRevision,
    employment: null,
  })
}, 15_000)
