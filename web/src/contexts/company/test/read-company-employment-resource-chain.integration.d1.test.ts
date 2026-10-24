import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { readCompanyEmploymentResourceChain } from "@/contexts/company/interface/operations/read-company-employment-resource-chain"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const organizationId = COMPANY_DEFAULT_ORGANIZATION_ID

test("雇用・従業員・人物の資源版を同じ会社版で取得する", async () => {
  const database = await createLocalD1Database({
    schema:
      readFileSync(
        new URL("../../system/infrastructure/schema/system-core.sql", import.meta.url),
        "utf8",
      ) +
      "\n" +
      readFileSync(new URL("../infrastructure/schema/company.sql", import.meta.url), "utf8"),
  })
  const repository = new D1CompanyResourceRepository({ database })
  const common = {
    organizationId,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  } as const
  const initial = CompanyResourceChangeEntity.create({
    commandId: "resource-chain:initial",
    expectedRevision: 0,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Confirm employment",
    recordedAt: 1,
    resources: [
      { ...common, type: "person", id: "person-1", attributes: { officialName: "First Name" } },
      {
        ...common,
        type: "employee",
        id: "349b77d2-3ea4-4a82-854c-c7aef39a04fb",
        attributes: { personId: "person-1", employeeCode: "E001" },
      },
      {
        ...common,
        type: "employment",
        id: "e9d2a8af-691a-41c5-beee-74a8f5de7388",
        attributes: {
          employeeId: "349b77d2-3ea4-4a82-854c-c7aef39a04fb",
          status: "ACTIVE",
          employmentType: "FULL_TIME",
        },
      },
    ],
  })
  if (initial instanceof Error) throw initial
  expect(await repository.write(initial)).toMatchObject({ kind: "applied" })

  const before = await readCompanyEmploymentResourceChain({
    database,
    organizationId,
    employmentId: "e9d2a8af-691a-41c5-beee-74a8f5de7388",
  })
  expect(before).toEqual({
    organizationRevision: 1,
    employmentId: "e9d2a8af-691a-41c5-beee-74a8f5de7388",
    employmentRevision: 1,
    employeeId: "349b77d2-3ea4-4a82-854c-c7aef39a04fb",
    employeeRevision: 1,
    personId: "person-1",
    personRevision: 1,
  })
  expect(
    await readCompanyEmploymentResourceChain({
      database,
      organizationId,
      employmentId: "0c164f06-5b57-457f-9378-48c436fe3fb7",
    }),
  ).toBeNull()

  const renamed = CompanyResourceChangeEntity.create({
    commandId: "resource-chain:rename",
    expectedRevision: 1,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Confirm new name",
    recordedAt: 2,
    resources: [
      {
        ...common,
        type: "person",
        id: "person-1",
        revision: 2,
        attributes: { officialName: "Second Name" },
      },
    ],
  })
  if (renamed instanceof Error) throw renamed
  expect(await repository.write(renamed)).toMatchObject({ kind: "applied" })
  expect(
    await readCompanyEmploymentResourceChain({
      database,
      organizationId,
      employmentId: "e9d2a8af-691a-41c5-beee-74a8f5de7388",
    }),
  ).toMatchObject({ organizationRevision: 2, personRevision: 2, employmentRevision: 1 })
})
