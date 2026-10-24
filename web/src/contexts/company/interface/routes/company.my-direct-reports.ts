import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import { ReadCompanySnapshotEmployeesAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-company-snapshot-employees.adapter"
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

// @authorization owner - 本人が現在管理する直属のCompany従業員だけを返す
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) throw new CompanyAuthenticationRequiredError()
  if (
    !actor.hasCapability("company:read") ||
    !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID)
  )
    throw new CompanyReadForbiddenError()
  if (actor.employeeId === null) return context.json({ data: [] }, 200)
  if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()

  const companyContext = {
    env: {
      DB: context.env.DB,
      COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
      ...(context.var.companyClock === undefined
        ? {}
        : { NOW: context.var.companyClock().toISOString() }),
    },
    var: { database: context.var.database, auditContext: context.var.auditContext },
  }
  const organization = await new ReadCanonicalOrganizationStateAdapter(
    companyContext,
  ).readCanonicalOrganizationState()
  if (organization instanceof Error) throw new CompanyReadUnavailableError(organization)

  const reportIds = new Set(
    organization.managementRelations
      .filter((relation) => relation.managerEmployeeId === actor.employeeId)
      .map((relation) => relation.employeeId),
  )
  const employees = await new ReadCompanySnapshotEmployeesAdapter(companyContext).read({
    employeeIds: organization.employees
      .filter((employee) => employee.status === "ACTIVE" && reportIds.has(employee.employeeId))
      .map((employee) => employee.employeeId),
    asOf: organization.organization.asOf,
    organizationRevision: organization.organization.revision,
    companyRevision: organization.companyRevision,
  })
  if (employees instanceof Error) throw new CompanyReadUnavailableError(employees)
  const data = employees
    .toSorted((left, right) =>
      (left.employeeCode ?? left.id).localeCompare(right.employeeCode ?? right.id),
    )
    .map((employee) => ({
      employee_id: employee.id,
      code: employee.employeeCode,
      name: employee.officialName,
      dept_name: employee.primaryAssignment?.organizationUnitName ?? null,
      position: employee.primaryAssignment?.positionTitle ?? null,
    }))

  return context.json({ data }, 200)
})
