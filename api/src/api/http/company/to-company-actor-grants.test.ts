import { describe, expect, test } from "bun:test"
import { toCompanyActorGrants } from "@/api/http/company/to-company-actor-grants"
import { ApplyOrganizationChange } from "@/contexts/company/application/organization/apply-organization-change"
import { CreateAccountEmployeeLinks } from "@/contexts/company/application/account-employee-links/create-account-employee-links"
import { CreateEmployees } from "@/contexts/company/application/employees/create-employees"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyActorValue } from "@/contexts/company/domain/values/company-actor.value"
import { toCompanyPersonnelSession } from "@/contexts/company/interface/operations/to-company-personnel-session"
import type { CompanyResourceWriteResult } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"

const managerPermissions = [
  "employee:read",
  "employee:create",
  "employee:update",
  "employee:lifecycle:request",
]
const organizationManagerPermissions = ["employee:read", "org:manage", "employee:lifecycle:apply"]

function toActor(granted: ReadonlyArray<string>): CompanyActorValue {
  const grants = toCompanyActorGrants((permission) => granted.includes(permission))
  return CompanyActorValue.restore({
    accountId: "c0975461-26d2-43a1-86d2-124bd000d9c9",
    employeeId: "b4b9edaa-1e08-46d5-b0bc-1798cc369fd1",
    organizationIds: [COMPANY_DEFAULT_ORGANIZATION_ID],
    capabilities: grants.capabilities,
    permissions: grants.permissions,
  })
}

function createRepository() {
  const writes: unknown[] = []
  const applied: CompanyResourceWriteResult = {
    kind: "applied",
    organizationRevision: 1,
    replayed: false,
  }
  return {
    writes,
    findMany: async () => {
      throw new Error("not used")
    },
    write: async (change: unknown) => {
      writes.push(change)
      return applied
    },
    writeOrganizationChange: async (change: unknown) => {
      writes.push(change)
      return applied
    },
  }
}

const organizationUnitChange = {
  commandId: "command:organization-unit",
  expectedRevision: 0,
  reason: "組織を作成する",
  recordedAt: 1,
  resources: [
    {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "organization-unit" as const,
      id: "organization-unit-period:root",
      revision: 1,
      state: "active" as const,
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
}

const accountLinkChange = {
  commandId: "command:account-link",
  expectedRevision: 0,
  reason: "アカウントを紐付ける",
  recordedAt: 1,
  resources: [
    {
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      type: "account-employee-link" as const,
      id: "account-link:one",
      revision: 1,
      state: "active" as const,
      effectiveFrom: restoreCalendarDate("2026-01-01"),
      effectiveTo: null,
      attributes: {
        accountId: "f3b9abc8-e975-4769-98eb-ffca70786ee5",
        employeeId: "9e174baf-3240-4253-9cba-16bc3e431cca",
      },
    },
  ],
}

describe("toCompanyActorGrants", () => {
  test("従業員の登録・更新権限から会社全体の変更資格と発令確定権限を導出しない", () => {
    const grants = toCompanyActorGrants((permission) => managerPermissions.includes(permission))

    expect(grants.capabilities).toEqual(["company:read", "company:workforce:update"])
    expect(grants.permissions).toContain("employee:write:basic")
    expect(grants.permissions).not.toContain("employee:write")
    expect(grants.permissions).not.toContain("org:write")
  })

  test("employee:createだけでは変更資格を持たない", () => {
    const grants = toCompanyActorGrants((permission) => permission === "employee:create")

    expect(grants).toEqual({ capabilities: [], permissions: [] })
  })

  test("アカウント管理権限と管理者だけがaccount_link:writeになる", () => {
    expect(toCompanyActorGrants((permission) => permission === "account:manage")).toEqual({
      capabilities: [],
      permissions: ["account_link:write"],
    })
    expect(
      toCompanyActorGrants((permission) => permission === "system:admin").permissions,
    ).toContain("account_link:write")
    expect(
      toCompanyActorGrants((permission) => organizationManagerPermissions.includes(permission))
        .permissions,
    ).not.toContain("account_link:write")
    expect(
      toCompanyActorGrants((permission) => managerPermissions.includes(permission)).permissions,
    ).not.toContain("account_link:write")
  })

  test("発令確定権限だけがemployee:writeになる", () => {
    const grants = toCompanyActorGrants((permission) => permission === "employee:lifecycle:apply")

    expect(grants.permissions).toEqual(["employee:write"])
    expect(grants.capabilities).toEqual([])
  })

  test("管理者と組織管理者は会社全体の変更資格を持つ", () => {
    expect(toCompanyActorGrants((permission) => permission === "system:admin")).toMatchObject({
      capabilities: ["company:read", "company:write", "company:admin"],
    })
    expect(
      toCompanyActorGrants((permission) => organizationManagerPermissions.includes(permission)),
    ).toMatchObject({ capabilities: ["company:read", "company:write"] })
  })
})

describe("業務管理者相当のCompany Actor", () => {
  const actor = toActor(managerPermissions)

  test("人事発令を直接確定できない", () => {
    expect(actor.hasPermission("employee:write")).toBe(false)
    expect(toCompanyPersonnelSession(actor)?.hasPermission("employee:lifecycle:apply")).toBe(false)
  })

  test("組織変更を書き込めない", async () => {
    const repository = createRepository()
    const result = await new ApplyOrganizationChange({ actor, repository }).execute(
      organizationUnitChange,
    )

    expect(result).toEqual({ kind: "forbidden" })
    expect(repository.writes).toHaveLength(0)
  })

  test("アカウントと従業員の紐付けを書き込めない", async () => {
    const repository = createRepository()
    const result = await new CreateAccountEmployeeLinks({ actor, repository }).execute(
      accountLinkChange,
    )

    expect(result).toEqual({ kind: "forbidden" })
    expect(repository.writes).toHaveLength(0)
  })

  test("登録手続きを経ずに従業員を作成できない", async () => {
    const repository = createRepository()
    const result = await new CreateEmployees({ actor, repository }).execute({
      ...accountLinkChange,
      resources: [
        {
          ...accountLinkChange.resources[0],
          type: "employee",
          id: "employee:one",
          attributes: {},
        },
      ],
    })

    expect(result).toEqual({ kind: "forbidden" })
    expect(repository.writes).toHaveLength(0)
  })
})

describe("管理者と組織管理者のCompany Actor", () => {
  for (const [label, granted] of [
    ["管理者", ["system:admin"]],
    ["組織とアカウントの管理者", [...organizationManagerPermissions, "account:manage"]],
  ] as const) {
    test(`${label}は組織変更と紐付けを書き込み、発令を確定できる`, async () => {
      const actor = toActor(granted)
      const repository = createRepository()

      expect(
        await new ApplyOrganizationChange({ actor, repository }).execute(organizationUnitChange),
      ).toMatchObject({ kind: "applied" })
      expect(
        await new CreateAccountEmployeeLinks({ actor, repository }).execute(accountLinkChange),
      ).toMatchObject({ kind: "applied" })
      expect(toCompanyPersonnelSession(actor)?.hasPermission("employee:lifecycle:apply")).toBe(true)
    })
  }

  test("アカウント管理権限の無い組織管理者は組織変更できるが紐付けを書き込めない", async () => {
    const actor = toActor(organizationManagerPermissions)
    const repository = createRepository()

    expect(
      await new ApplyOrganizationChange({ actor, repository }).execute(organizationUnitChange),
    ).toMatchObject({ kind: "applied" })
    expect(
      await new CreateAccountEmployeeLinks({ actor, repository }).execute(accountLinkChange),
    ).toEqual({ kind: "forbidden" })
    expect(repository.writes).toHaveLength(1)
  })

  test("アカウント管理権限だけでは会社全体の変更資格が無く紐付けを書き込めない", async () => {
    const actor = toActor(["account:manage"])
    const repository = createRepository()

    expect(actor.hasPermission("account_link:write")).toBe(true)
    expect(
      await new CreateAccountEmployeeLinks({ actor, repository }).execute(accountLinkChange),
    ).toEqual({ kind: "forbidden" })
    expect(repository.writes).toHaveLength(0)
  })
})
