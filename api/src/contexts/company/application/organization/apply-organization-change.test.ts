import { expect, test } from "bun:test"
import { ApplyOrganizationChange } from "@/contexts/company/application/organization/apply-organization-change"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const actor = CompanyActorValue.restore({
  accountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
  employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
  organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
  capabilities: ["company:write"],
})

test("ApplyOrganizationChangeは永続化経路の例外をunavailableへ閉じる", async () => {
  let writeAttempts = 0
  const applyOrganizationChange = new ApplyOrganizationChange({
    actor,
    repository: {
      writeOrganizationChange: async () => {
        writeAttempts += 1
        throw new Error("write unavailable")
      },
    },
  })
  const result = await applyOrganizationChange.execute({
    commandId: "command:1",
    expectedRevision: 0,
    reason: "create root organization",
    recordedAt: 1,
    resources: [
      {
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "organization-unit",
        id: "organization-unit-period:root",
        revision: 1,
        state: "active",
        effectiveFrom: restoreCalendarDate("2026-01-01"),
        effectiveTo: null,
        attributes: {
          organizationUnitId: "organization-unit:root",
          code: "ROOT",
          officialName: "Company",
          kind: "COMPANY",
          parentOrganizationUnitId: null,
        },
      },
    ],
  })

  expect(result).toMatchObject({ kind: "unavailable", cause: { message: "write unavailable" } })
  expect(writeAttempts).toBe(1)
})

test("限定資格は人物を変更できるが法人資源との混在は再送でも拒否する", async () => {
  const workforceActor = CompanyActorValue.restore({
    accountId: "76e2eea1-f607-4020-90cf-7433ebf4d242",
    employeeId: null,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:workforce:update"],
  })
  let writeAttempts = 0
  const command = new ApplyOrganizationChange({
    actor: workforceActor,
    repository: {
      writeOrganizationChange: async () => {
        writeAttempts += 1
        return { kind: "applied", organizationRevision: 1, replayed: false }
      },
    },
  })
  const person = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "person" as const,
    id: "person:one",
    revision: 2,
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2026-01-01"),
    effectiveTo: null,
    attributes: { officialName: "職員" },
  }
  const change = {
    commandId: "command:workforce",
    expectedRevision: 0,
    reason: "氏名を確認した",
    recordedAt: 1,
    resources: [person],
  }

  expect(await command.execute(change)).toMatchObject({ kind: "applied" })
  expect(writeAttempts).toBe(1)

  expect(
    await command.execute({ ...change, resources: [{ ...person, revision: 1 }] }),
  ).toMatchObject({ kind: "forbidden" })
  expect(
    await command.execute({ ...change, resources: [{ ...person, revision: 3, state: "void" }] }),
  ).toMatchObject({ kind: "forbidden" })
  expect(
    await command.execute({
      ...change,
      resources: [
        {
          ...person,
          type: "account-employee-link",
          id: "account-link:one",
          attributes: {
            accountId: "f3b9abc8-e975-4769-98eb-ffca70786ee5",
            employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
          },
        },
      ],
    }),
  ).toMatchObject({ kind: "forbidden" })

  const mixed = {
    ...change,
    resources: [
      person,
      {
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        type: "legal-entity" as const,
        id: "legal-entity:one",
        revision: 1,
        state: "active" as const,
        effectiveFrom: restoreCalendarDate("2026-01-01"),
        effectiveTo: null,
        attributes: {
          officialName: "会社",
          jurisdictionCountryCode: "JP",
          registrationNumber: null,
          defaultCurrencyCode: "JPY",
        },
      },
    ],
  }
  expect(await command.execute(mixed)).toMatchObject({ kind: "forbidden" })
  expect(writeAttempts).toBe(1)
})

test("限定人事資格は根拠と訂正元を持つ雇用期間の取消・代替だけを確定できる", async () => {
  const workforceActor = CompanyActorValue.restore({
    accountId: "76e2eea1-f607-4020-90cf-7433ebf4d242",
    employeeId: null,
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: ["company:workforce:update"],
  })
  let writeAttempts = 0
  const command = new ApplyOrganizationChange({
    actor: workforceActor,
    repository: {
      writeOrganizationChange: async () => {
        writeAttempts += 1
        return { kind: "applied", organizationRevision: 2, replayed: false }
      },
    },
  })
  const employment = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "employment" as const,
    id: "employment:one",
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2026-02-01"),
    effectiveTo: null,
    attributes: {
      employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
      status: "ACTIVE",
      employmentType: "FULL_TIME",
    },
  }
  const change = {
    commandId: "command:correct-start",
    expectedRevision: 1,
    reason: "入社原資料による開始日訂正",
    recordedAt: 2,
    evidenceReferences: [
      { context: "system", kind: "document", id: "hire:original", version: "1" },
    ],
    corrections: [2, 3].map((revision) => ({
      type: "employment" as const,
      id: employment.id,
      revision,
      correctsRevision: 1,
    })),
    resources: [
      { ...employment, revision: 2, state: "void" as const },
      { ...employment, revision: 3 },
    ],
  }

  expect(await command.execute(change)).toMatchObject({ kind: "applied" })
  expect(writeAttempts).toBe(1)
  expect(await command.execute({ ...change, evidenceReferences: [] })).toMatchObject({
    kind: "invalid",
  })
  expect(
    await command.execute({ ...change, corrections: change.corrections.slice(0, 1) }),
  ).toMatchObject({ kind: "forbidden" })
  expect(writeAttempts).toBe(1)
})
