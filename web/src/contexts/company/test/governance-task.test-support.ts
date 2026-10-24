import type { CompanyContext } from "@/contexts/company/configuration/company-context"
import { createExternalIdentityImportTestContext } from "@/contexts/company/test/external-identity-import.test-support"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import type { CompanyResourceProps } from "@/contexts/company/domain/entities/company-resource.entity"
import type { ApplicationWorkflowStep } from "@/contexts/company/domain/definitions/company-procedure-workflow.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { drizzle } from "drizzle-orm/d1"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

/** 公開Companyへの入社登録と責務規程を、両製品の実migrationへ作成する。 */
export async function createGovernanceTaskTestContext(databaseOverride?: D1Database) {
  const imported = await createExternalIdentityImportTestContext("oidc", databaseOverride)
  const source = imported.input.identities[0]
  if (source === undefined) throw new Error("identity fixture is missing")
  const applied = await imported.application.execute({
    ...imported.input,
    identities: [0, 1, 2, 3].map((index) => ({
      ...source,
      subject: `member-${index}`,
      email: `member-${index}@example.com`,
      name: `Member ${index}`,
    })),
  })
  if (applied.kind !== "applied") throw new Error(`identity setup failed: ${applied.kind}`)
  const database = imported.database
  const people = (
    await database
      .prepare(`SELECT employee.id, link.account_id FROM company_employees employee
    JOIN company_account_employee_links link ON link.employee_id = employee.id ORDER BY employee.official_name`)
      .all<{ id: string; account_id: string }>()
  ).results.map((row) => ({
    employeeId: restoreWorkforceId("employee", row.id),
    accountId: zAccountId.parse(row.account_id),
  }))
  const creator = people[0]
  if (creator === undefined) throw new Error("creator fixture is missing")
  const date = resolveCompanyBusinessDate({
    now: imported.clock.at.toISOString(),
    timeZone: "Asia/Tokyo",
  })
  if (date instanceof Error) throw date
  const base = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    revision: 1,
    effectiveFrom: restoreCalendarDate(date),
    effectiveTo: null,
  }
  const resources: CompanyResourceProps[] = [
    {
      ...base,
      state: "active",
      type: "responsibility",
      id: "responsibility:approve",
      attributes: { code: "APPROVE", officialName: "Approval" },
    },
    {
      ...base,
      state: "active",
      type: "authority-scope",
      id: "scope:amount",
      attributes: {
        scopeType: "amount",
        currencyCode: "JPY",
        minimumAmount: 100,
        maximumAmount: 1000,
      },
    },
    {
      ...base,
      state: "active",
      type: "collective-body",
      id: "body:committee",
      attributes: {
        code: "COMMITTEE",
        officialName: "Committee",
        quorumType: "count",
        quorumValue: 2,
        decisionRule: "majority",
      },
    },
    {
      ...base,
      state: "active",
      type: "responsibility-assignment",
      id: "assignment:approve",
      attributes: {
        responsibilityId: "responsibility:approve",
        holderType: "collective-body",
        holderId: "body:committee",
        authorityScopeId: "scope:amount",
        delegationAllowed: false,
      },
    },
    ...people.slice(1).map(
      (person, index): CompanyResourceProps => ({
        ...base,
        state: "active",
        type: "collective-body-membership",
        id: `membership:${index}`,
        attributes: {
          collectiveBodyId: "body:committee",
          employeeId: person.employeeId,
          role: "member",
          voting: true,
        },
      }),
    ),
  ]
  const write = async (changes: ReadonlyArray<CompanyResourceProps>) => {
    const revision = await database
      .prepare(
        `SELECT revision FROM company_organizations WHERE id = '${COMPANY_DEFAULT_ORGANIZATION_ID}'`,
      )
      .first<number>("revision")
    if (revision === null) throw new Error("organization is missing")
    const change = CompanyResourceChangeEntity.create({
      commandId: crypto.randomUUID(),
      expectedRevision: revision,
      actorAccountId: imported.actor.accountId,
      reason: "Update decision policy",
      recordedAt: imported.clock.at.getTime(),
      resources: changes,
    })
    if (change instanceof Error) throw change
    const saved = await new D1CompanyResourceRepository({ database }).write(change)
    if (saved.kind !== "applied")
      throw new Error(`governance setup failed: ${saved.kind}`, { cause: saved })
  }
  await write(resources)
  const accountLinks = await new D1CompanyResourceRepository({ database }).findMany({
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    types: ["account-employee-link"],
  })
  if (!accountLinks.ok) throw accountLinks.cause
  resources.push(...accountLinks.resources)
  const step: ApplicationWorkflowStep = {
    key: "governance-review",
    name: "Committee review",
    approvers: [],
    approval_mode: "any",
    condition_mode: "all",
    conditions: [],
    due_days: null,
    escalation_approvers: [],
    rejection_behavior: "reject",
    allow_delegation: true,
    governance_authority: {
      organization_id: COMPANY_DEFAULT_ORGANIZATION_ID,
      responsibility_code: "APPROVE",
      scope: { scope_type: "amount", currency_code: "JPY", amount_field: "amount" },
    },
  }
  const context: CompanyContext = {
    env: { DB: database, COMPANY_TIME_ZONE: "Asia/Tokyo", NOW: imported.clock.at.toISOString() },
    var: {
      database: drizzle(database),
      auditContext: {
        requestId: "governance-test",
        clientName: "api",
        clientIp: null,
        externalRequestId: null,
      },
    },
  }
  return { database, creator, people, resources, write, step, context, at: imported.clock.at }
}
