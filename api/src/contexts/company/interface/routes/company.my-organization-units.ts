import { CurrentOrganizationReadModelAdapter } from "@/contexts/company/infrastructure/adapters/organization/current-organization-read-model.adapter"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createFactory } from "hono/factory"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization owner - 本人が現在所属するCompany組織単位だけを返す
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) throw new CompanyAuthenticationRequiredError()
  if (
    !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
    !actor.hasCapability("company:read")
  )
    throw new CompanyReadForbiddenError()
  if (actor.employeeId === null) return context.json({ data: [] }, 200)
  if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()

  const organization = await new CurrentOrganizationReadModelAdapter({
    env: {
      DB: context.env.DB,
      COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
      ...(context.var.companyClock === undefined
        ? {}
        : { NOW: context.var.companyClock().toISOString() }),
    },
    var: { database: context.var.database, auditContext: context.var.auditContext },
  }).loadCurrentOrganization()
  if (organization instanceof Error) throw new CompanyReadUnavailableError(organization)

  const viewer = [...organization.employeesByCode.values()].find(
    (employee) => employee.id === actor.employeeId,
  )
  if (viewer === undefined) return context.json({ data: [] }, 200)
  const nameByCode = new Map(
    organization.departments.map((department) => [department.code, department.name] as const),
  )
  const data = [...viewer.assignments]
    .sort((left, right) => {
      if (left.assignmentType === right.assignmentType) {
        return left.departmentCode.localeCompare(right.departmentCode)
      }
      return left.assignmentType === "primary" ? -1 : 1
    })
    .flatMap((assignment) => {
      const name = nameByCode.get(assignment.departmentCode)
      return name === undefined
        ? []
        : [
            {
              code: assignment.departmentCode,
              name,
              assignment_type: assignment.assignmentType,
            },
          ]
    })

  return context.json({ data }, 200)
})
