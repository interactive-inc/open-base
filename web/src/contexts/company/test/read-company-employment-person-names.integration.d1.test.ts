import { expect, setDefaultTimeout, test } from "bun:test"
import { readFileSync } from "node:fs"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { readCompanyEmploymentPersonNames } from "@/contexts/company/interface/operations/read-company-employment-person-names"
import { readCompanyEmploymentDirectory } from "@/contexts/company/interface/operations/read-company-employment-directory"
import { readCompanyEmploymentStartDates } from "@/contexts/company/interface/operations/read-company-employment-start-dates"
import { readCompanyEmploymentsByEmployee } from "@/contexts/company/interface/operations/read-company-employments-by-employee"
import { createLocalD1Database } from "@system/test/local-d1/create-local-d1-database.test-support"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

// ローカルD1のtemplate作成とDBごとの往復を含むため、既定の5秒を超えることがある。
setDefaultTimeout(30_000)

const organizationId = COMPANY_DEFAULT_ORGANIZATION_ID
const effectiveOn = restoreCalendarDate("2030-06-01")

test("雇用から人物氏名を同じ会社版で引き、改名後も旧版を再現する", async () => {
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
  const base = {
    organizationId,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  } as const
  const resources: CompanyResourceProps[] = [
    {
      ...base,
      type: "person",
      id: "person:one",
      attributes: { officialName: "Old Name" },
    },
    {
      ...base,
      type: "employee",
      id: "9e174baf-3240-4253-9cba-16bc3e431cca",
      attributes: { personId: "person:one", employeeCode: "E001" },
    },
    {
      ...base,
      type: "employment",
      id: "e7173538-06d6-4031-9c04-9915e8eaebbc",
      attributes: {
        employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
        status: "ACTIVE",
        employmentType: "FULL_TIME",
      },
    },
  ]
  const first = CompanyResourceChangeEntity.create({
    commandId: "names:initial",
    expectedRevision: 0,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Register confirmed person",
    recordedAt: 1,
    resources,
  })
  if (first instanceof Error) throw first
  expect(await repository.write(first)).toMatchObject({
    kind: "applied",
    organizationRevision: 1,
  })

  const previous = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc", "employment:missing"],
    effectiveOn,
  })
  if (previous instanceof Error) throw previous
  expect(previous.organizationRevision).toBe(1)
  expect([...previous.names]).toEqual([["e7173538-06d6-4031-9c04-9915e8eaebbc", "Old Name"]])

  const beforeHire = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc"],
    effectiveOn: restoreCalendarDate("2029-12-31"),
    organizationRevision: previous.organizationRevision,
  })
  if (beforeHire instanceof Error) throw beforeHire
  expect([...beforeHire.names]).toEqual([])

  const beforeHireWithEnded = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc"],
    effectiveOn: restoreCalendarDate("2029-12-31"),
    includeEndedEmployments: true,
    organizationRevision: previous.organizationRevision,
  })
  if (beforeHireWithEnded instanceof Error) throw beforeHireWithEnded
  expect([...beforeHireWithEnded.names]).toEqual([])

  const correction = CompanyResourceChangeEntity.create({
    commandId: "names:change",
    expectedRevision: 1,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Confirmed name change",
    recordedAt: 2,
    resources: [
      {
        ...resources[0]!,
        revision: 2,
        attributes: { officialName: "New Name" },
      },
    ],
  })
  if (correction instanceof Error) throw correction
  expect(await repository.write(correction)).toMatchObject({
    kind: "applied",
    organizationRevision: 2,
  })

  const current = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc"],
    effectiveOn,
  })
  if (current instanceof Error) throw current
  expect(current.organizationRevision).toBe(2)
  expect(current.names.get("e7173538-06d6-4031-9c04-9915e8eaebbc")).toBe("New Name")

  const historical = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc"],
    effectiveOn,
    organizationRevision: previous.organizationRevision,
  })
  if (historical instanceof Error) throw historical
  expect(historical.organizationRevision).toBe(1)
  expect(historical.names.get("e7173538-06d6-4031-9c04-9915e8eaebbc")).toBe("Old Name")

  const unknownRevision = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc"],
    effectiveOn,
    organizationRevision: 3,
  })
  expect(unknownRevision).toBeInstanceOf(Error)

  const closure = CompanyResourceChangeEntity.create({
    commandId: "names:employment-ended",
    expectedRevision: 2,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Confirmed employment end",
    recordedAt: 3,
    resources: [
      {
        ...resources[2]!,
        revision: 2,
        effectiveTo: restoreCalendarDate("2030-05-01"),
      },
    ],
  })
  if (closure instanceof Error) throw closure
  expect(await repository.write(closure)).toMatchObject({
    kind: "applied",
    organizationRevision: 3,
  })

  const activeOnly = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc"],
    effectiveOn,
  })
  if (activeOnly instanceof Error) throw activeOnly
  expect([...activeOnly.names]).toEqual([])

  const endedForAttribution = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc"],
    effectiveOn,
    includeEndedEmployments: true,
  })
  if (endedForAttribution instanceof Error) throw endedForAttribution
  expect(endedForAttribution.organizationRevision).toBe(3)
  expect(endedForAttribution.names.get("e7173538-06d6-4031-9c04-9915e8eaebbc")).toBe("New Name")
  const currentDirectory = await readCompanyEmploymentDirectory({
    database,
    organizationId,
    effectiveOn,
    organizationRevision: 3,
  })
  if (currentDirectory instanceof Error) throw currentDirectory
  expect(currentDirectory.items).toEqual([])
  const endedDirectory = await readCompanyEmploymentDirectory({
    database,
    organizationId,
    effectiveOn,
    includeEndedEmployments: true,
    organizationRevision: 3,
  })
  if (endedDirectory instanceof Error) throw endedDirectory
  expect(endedDirectory.items).toMatchObject([
    {
      employmentId: "e7173538-06d6-4031-9c04-9915e8eaebbc",
      personName: "New Name",
      status: "ACTIVE",
      startedOn: "2030-01-01",
      effectiveTo: "2030-05-01",
    },
  ])
  const unrelated = await readCompanyEmploymentDirectory({
    database,
    organizationId,
    effectiveOn,
    employmentIds: ["employment:missing"],
    includeEndedEmployments: true,
    organizationRevision: 3,
  })
  if (unrelated instanceof Error) throw unrelated
  expect(unrelated.items).toEqual([])
  expect(
    await readCompanyEmploymentDirectory({
      database,
      organizationId,
      effectiveOn,
      employmentIds: [],
    }),
  ).toBeInstanceOf(Error)

  const pinnedEnded = await readCompanyEmploymentPersonNames({
    database,
    organizationId,
    employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc"],
    effectiveOn,
    includeEndedEmployments: true,
    organizationRevision: 3,
  })
  if (pinnedEnded instanceof Error) throw pinnedEnded
  expect([...pinnedEnded.names]).toEqual([["e7173538-06d6-4031-9c04-9915e8eaebbc", "New Name"]])

  const currentEmployment = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["9e174baf-3240-4253-9cba-16bc3e431cca", "employee:missing"],
    effectiveOn,
  })
  if (currentEmployment instanceof Error) throw currentEmployment
  expect([...currentEmployment.employmentIdsByEmployee]).toEqual([
    ["9e174baf-3240-4253-9cba-16bc3e431cca", []],
    ["employee:missing", []],
  ])

  const pastEmployment = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["9e174baf-3240-4253-9cba-16bc3e431cca", "employee:missing"],
    effectiveOn,
    includeEndedEmployments: true,
    organizationRevision: 3,
  })
  if (pastEmployment instanceof Error) throw pastEmployment
  expect(pastEmployment.organizationRevision).toBe(3)
  expect([...pastEmployment.employmentIdsByEmployee]).toEqual([
    ["9e174baf-3240-4253-9cba-16bc3e431cca", ["e7173538-06d6-4031-9c04-9915e8eaebbc"]],
    ["employee:missing", []],
  ])

  const priorEmployment = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["9e174baf-3240-4253-9cba-16bc3e431cca"],
    effectiveOn,
    organizationRevision: 2,
  })
  if (priorEmployment instanceof Error) throw priorEmployment
  expect(
    priorEmployment.employmentIdsByEmployee.get("9e174baf-3240-4253-9cba-16bc3e431cca"),
  ).toEqual(["e7173538-06d6-4031-9c04-9915e8eaebbc"])

  const rehire = CompanyResourceChangeEntity.create({
    commandId: "names:rehire",
    expectedRevision: 3,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Confirmed new employment after leaving",
    recordedAt: 4,
    resources: [
      {
        ...resources[2]!,
        id: "f1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b",
        effectiveFrom: restoreCalendarDate("2030-05-01"),
      },
    ],
  })
  if (rehire instanceof Error) throw rehire
  expect(await repository.write(rehire)).toMatchObject({
    kind: "applied",
    organizationRevision: 4,
  })

  const afterRehire = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["9e174baf-3240-4253-9cba-16bc3e431cca"],
    effectiveOn,
  })
  if (afterRehire instanceof Error) throw afterRehire
  expect(afterRehire.employmentIdsByEmployee.get("9e174baf-3240-4253-9cba-16bc3e431cca")).toEqual([
    "f1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b",
  ])
  const allRecordedEmployments = await readCompanyEmploymentsByEmployee({
    database,
    organizationId,
    employeeIds: ["9e174baf-3240-4253-9cba-16bc3e431cca"],
    effectiveOn,
    includeEndedEmployments: true,
  })
  if (allRecordedEmployments instanceof Error) throw allRecordedEmployments
  expect(
    allRecordedEmployments.employmentIdsByEmployee.get("9e174baf-3240-4253-9cba-16bc3e431cca"),
  ).toEqual(["e7173538-06d6-4031-9c04-9915e8eaebbc", "f1a2b3c4-d5e6-4f70-8a9b-0c1d2e3f4a5b"])
})

test("雇用状態が後日変わっても開始日は最初の確定期間から読む", async () => {
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
  const base = {
    organizationId,
    revision: 1,
    state: "active",
    effectiveFrom: restoreCalendarDate("2030-01-01"),
    effectiveTo: null,
  } as const
  const employment: CompanyResourceProps = {
    ...base,
    type: "employment",
    id: "e7173538-06d6-4031-9c04-9915e8eaebbc",
    attributes: {
      employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
      status: "ACTIVE",
      employmentType: "FULL_TIME",
    },
  }
  const initial = CompanyResourceChangeEntity.create({
    commandId: "start:initial",
    expectedRevision: 0,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Confirmed hire",
    recordedAt: 1,
    resources: [
      { ...base, type: "person", id: "person:one", attributes: { officialName: "One" } },
      {
        ...base,
        type: "employee",
        id: "9e174baf-3240-4253-9cba-16bc3e431cca",
        attributes: { personId: "person:one", employeeCode: "E001" },
      },
      employment,
    ],
  })
  if (initial instanceof Error) throw initial
  expect(await repository.write(initial)).toMatchObject({
    kind: "applied",
    organizationRevision: 1,
  })

  const leave = CompanyResourceChangeEntity.create({
    commandId: "start:leave",
    expectedRevision: 1,
    actorAccountId: "5b3d7ccc-33e7-4afb-935e-d89535c31674",
    reason: "Confirmed leave",
    recordedAt: 2,
    resources: [
      {
        ...employment,
        revision: 2,
        effectiveFrom: restoreCalendarDate("2030-03-01"),
        attributes: { ...employment.attributes, status: "ON_LEAVE" },
      },
    ],
  })
  if (leave instanceof Error) throw leave
  expect(await repository.write(leave)).toMatchObject({ kind: "applied", organizationRevision: 2 })

  const current = await readCompanyEmploymentDirectory({
    database,
    organizationId,
    effectiveOn,
    organizationRevision: 2,
  })
  if (current instanceof Error) throw current
  expect(current.items).toMatchObject([
    {
      employmentId: "e7173538-06d6-4031-9c04-9915e8eaebbc",
      status: "ON_LEAVE",
      startedOn: "2030-01-01",
    },
  ])
  const historical = await readCompanyEmploymentDirectory({
    database,
    organizationId,
    effectiveOn,
    organizationRevision: 1,
  })
  if (historical instanceof Error) throw historical
  expect(historical.items).toMatchObject([
    {
      employmentId: "e7173538-06d6-4031-9c04-9915e8eaebbc",
      status: "ACTIVE",
      startedOn: "2030-01-01",
    },
  ])
  expect(
    await readCompanyEmploymentStartDates({
      database,
      organizationId,
      employmentIds: ["employment:missing"],
      organizationRevision: 2,
    }),
  ).toBeInstanceOf(Error)
  expect(
    await readCompanyEmploymentStartDates({
      database,
      organizationId,
      employmentIds: ["e7173538-06d6-4031-9c04-9915e8eaebbc"],
      organizationRevision: -1,
    }),
  ).toBeInstanceOf(Error)
})
