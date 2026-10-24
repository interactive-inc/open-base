/** /company/reporting-lines/:employeeCode */
import { ReadCanonicalOrganizationStateAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-canonical-organization-state.adapter"
import { ReadCompanySnapshotEmployeesAdapter } from "@/contexts/company/infrastructure/adapters/organization/read-company-snapshot-employees.adapter"
import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyReportingLineNotFoundError,
  CompanyQueryInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - company:read capabilityで報告ラインを読む
export const GET = factory.createHandlers(
  zValidator(
    "param",
    z.object({ employeeCode: z.string().trim().min(1).max(255) }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.hasCapability("company:read") ||
      !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID)
    )
      throw new CompanyReadForbiddenError()
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
    const employees = await new ReadCompanySnapshotEmployeesAdapter(companyContext).read({
      employeeIds: organization.employees
        .filter((employee) => employee.status === "ACTIVE" || employee.status === "ON_LEAVE")
        .map((employee) => employee.employeeId),
      asOf: organization.organization.asOf,
      organizationRevision: organization.organization.revision,
      companyRevision: organization.companyRevision,
    })
    if (employees instanceof Error) throw new CompanyReadUnavailableError(employees)
    const identifier = context.req.valid("param").employeeCode
    const employee =
      employees.find((entry) => entry.id === identifier) ??
      employees.find((entry) => entry.employeeCode === identifier)
    if (employee === undefined) throw new CompanyReportingLineNotFoundError()

    const employeeById = new Map(employees.map((entry) => [entry.id, entry]))
    const managersByEmployeeId = new Map<EmployeeId, Set<EmployeeId>>()
    for (const relation of organization.managementRelations) {
      const managers = managersByEmployeeId.get(relation.employeeId)
      if (managers === undefined)
        managersByEmployeeId.set(relation.employeeId, new Set([relation.managerEmployeeId]))
      else managers.add(relation.managerEmployeeId)
    }
    const nodes: Array<{
      employee_id: EmployeeId
      employee_code: string | null
      employee_name: string
      department_code: string | null
      position: string | null
      depth: number
      manager_employee_ids: ReadonlyArray<EmployeeId>
    }> = []
    const visited = new Set<EmployeeId>([employee.id])
    const queue = [{ id: employee.id, depth: 0 }]
    for (let offset = 0; offset < queue.length; offset += 1) {
      const next = queue[offset]
      if (next === undefined) continue
      const current = employeeById.get(next.id)
      if (current === undefined)
        throw new CompanyReadUnavailableError(new Error("Company reporting employee missing"))
      const managerIds = [...(managersByEmployeeId.get(current.id) ?? [])].toSorted()
      nodes.push({
        employee_id: current.id,
        employee_code: current.employeeCode,
        employee_name: current.officialName,
        department_code: current.primaryAssignment?.organizationUnitCode ?? null,
        position: current.primaryAssignment?.positionTitle ?? null,
        depth: next.depth,
        manager_employee_ids: managerIds,
      })
      for (const id of managerIds) {
        if (visited.has(id)) continue
        visited.add(id)
        queue.push({ id, depth: next.depth + 1 })
      }
    }

    return context.json(nodes, 200)
  },
)
