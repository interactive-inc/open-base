/** /company/organization-tree */
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

type TreeNode = {
  code: string
  name: string
  manager_employee_code: string | null
  member_count: number
  children: TreeNode[]
}

// @authorization permission - company:read capabilityで組織ツリーを読む
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) throw new CompanyAuthenticationRequiredError()
  if (
    !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
    !actor.hasCapability("company:read")
  )
    throw new CompanyReadForbiddenError()
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

  const memberCounts = new Map<string, number>()
  for (const employee of organization.employeesByCode.values()) {
    for (const unitCode of employee.departmentCodes) {
      memberCounts.set(unitCode, (memberCounts.get(unitCode) ?? 0) + 1)
    }
  }
  const nodes = new Map<string, TreeNode>()
  for (const unit of organization.departments) {
    nodes.set(unit.code, {
      code: unit.code,
      name: unit.name,
      manager_employee_code: organization.managerByDepartmentCode.get(unit.code) ?? null,
      member_count: memberCounts.get(unit.code) ?? 0,
      children: [],
    })
  }
  const roots: TreeNode[] = []
  for (const unit of organization.departments) {
    const node = nodes.get(unit.code)!
    const parent = unit.parentCode === null ? undefined : nodes.get(unit.parentCode)
    if (parent === undefined) roots.push(node)
    else parent.children.push(node)
  }

  return context.json(roots, 200)
})
