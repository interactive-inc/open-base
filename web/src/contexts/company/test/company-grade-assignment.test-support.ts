import { expect } from "bun:test"
import { createCompanyAssignmentResourceTestContext } from "@/contexts/company/test/company-assignment-resource.test-support"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

export async function createCompanyGradeAssignmentTestContext() {
  const base = await createCompanyAssignmentResourceTestContext()
  const assignment = await base.initializeAssignment()
  type Resource = NonNullable<Parameters<typeof base.write>[0]>[number]
  const grade: Extract<Resource, { type: "grade" }> = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "grade",
    id: "grade:confirmed",
    revision: 1,
    state: "active",
    effectiveFrom: "2030-01-01",
    effectiveTo: null,
    attributes: { code: "G1", officialName: "Grade One", rank: 1, description: "Confirmed grade" },
  }
  const appointment: Extract<Resource, { type: "grade-assignment" }> = {
    organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
    type: "grade-assignment",
    id: "grade-assignment:confirmed",
    revision: 1,
    state: "active",
    effectiveFrom: "2030-03-01",
    effectiveTo: null,
    attributes: {
      employeeId: assignment.attributes.employeeId,
      employmentId: assignment.attributes.employmentId,
      gradeId: grade.id,
    },
  }
  const expectedRevision = await base.companyRevision()
  expect(
    Number((await base.write([appointment, grade], expectedRevision, "grade:initial")).status),
  ).toBe(201)
  const read = async (date: string) => {
    const snapshot = await new D1CompanyResourceRepository({ database: base.database }).findMany({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      types: ["grade-assignment"],
      effectiveOn: restoreCalendarDate(date),
    })
    if (!snapshot.ok) throw snapshot.cause
    return snapshot.resources
  }
  return { ...base, grade, appointment, read, expectedRevision }
}
