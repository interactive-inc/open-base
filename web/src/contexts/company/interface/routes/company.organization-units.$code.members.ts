/** /company/organization-units/:code/members */
import { CurrentOrganizationReadModelAdapter } from "@/contexts/company/infrastructure/adapters/organization/current-organization-read-model.adapter"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyOrganizationUnitNotFoundError,
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

// @authorization permission - company:read capabilityで組織所属者を読む
export const GET = factory.createHandlers(
  zValidator("param", z.object({ code: z.string().trim().min(1).max(64) }), (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !actor.hasCapability("company:read")
    )
      throw new CompanyReadForbiddenError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const code = context.req.valid("param").code

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
    if (!organization.departments.some((unit) => unit.code === code)) {
      throw new CompanyOrganizationUnitNotFoundError()
    }

    return context.json(
      [...organization.employeesByCode.values()]
        .flatMap((employee) => {
          const assignment = employee.assignments.find(
            (candidate) => candidate.departmentCode === code,
          )
          return assignment === undefined
            ? []
            : [
                {
                  employee_code: employee.code,
                  employee_name: employee.name,
                  position: assignment.position,
                  manager_employee_code: assignment.managerEmployeeCode,
                  manager_employee_codes: assignment.managerEmployeeCodes,
                  manager_employee_ids: assignment.managerEmployeeIds,
                  is_manager: employee.code === organization.managerByDepartmentCode.get(code),
                },
              ]
        })
        .toSorted((left, right) => left.employee_code.localeCompare(right.employee_code)),
      200,
    )
  },
)
