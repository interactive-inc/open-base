import { expect } from "bun:test"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { CompanyResourceChangeEntity } from "@/contexts/company/domain/entities/company-resource-change.entity"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

export async function createCompanyAuthorityEmploymentTestContext(
  type: "office-assignment" | "organizational-authority",
) {
  const f = await createCompanyAssignmentResourceTestContext()
  const assignment = await f.initializeAssignment()
  const common = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    revision: 1,
    state: "active" as const,
    effectiveFrom: restoreCalendarDate("2030-03-01"),
    effectiveTo: null,
  }
  const attributes = {
    employeeId: assignment.attributes.employeeId,
    employmentId: assignment.attributes.employmentId,
  }
  const change = CompanyResourceChangeEntity.create({
    commandId: `authority:${type}`,
    expectedRevision: await f.companyRevision(),
    actorAccountId: f.creator.accountId,
    reason: "Confirm authority appointment",
    recordedAt: f.at.getTime(),
    resources: [
      {
        ...common,
        type: "position",
        id: "position:authority-test",
        attributes: { code: "TEAM_LEAD", officialName: "Team Lead" },
      },
      {
        ...common,
        type: "organizational-office",
        id: "office:authority-test",
        attributes: {
          code: "TEAM_LEAD",
          officialName: "Team Lead",
          organizationUnitId: "0190005f-0000-7000-8000-3e026079e0b5",
          positionId: "position:authority-test",
        },
      },
      type === "office-assignment"
        ? {
            ...common,
            type,
            id: "appointment:authority-test",
            attributes: { ...attributes, organizationalOfficeId: "office:authority-test" },
          }
        : {
            ...common,
            type,
            id: "appointment:authority-test",
            attributes: {
              ...attributes,
              scopeType: "organization-unit",
              scopeId: "0190005f-0000-7000-8000-3e026079e0b5",
              authority: "WORK_REVIEW",
            },
          },
    ],
  })
  if (change instanceof Error) throw change
  const written = await new D1CompanyResourceRepository({ database: f.database }).write(change)
  expect(written).toMatchObject({ kind: "applied" })
  const appointment = change.resources.find((resource) => resource.type === type)
  if (appointment === undefined) throw new Error("appointment missing")
  return { ...f, assignment, appointment }
}
