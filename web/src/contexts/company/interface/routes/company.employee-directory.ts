/** /company/employee-directory */
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyQueryInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - Company Actor の company:read capability で在籍者だけを読む
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z.object({
      q: z.string().trim().min(1).max(200).optional(),
      organization_unit: z.string().trim().min(1).max(200).optional(),
      status: z.enum(["active", "leave", "retired"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).max(10_000).default(0),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (!actor.hasCapability("company:read")) throw new CompanyReadForbiddenError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()

    const query = context.req.valid("query")
    const page = await new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        ...(context.var.companyClock === undefined
          ? {}
          : { NOW: context.var.companyClock().toISOString() }),
      },
    }).list({
      query: query.q ?? null,
      organizationUnit: query.organization_unit ?? null,
      status: query.status ?? null,
      limit: query.limit,
      offset: query.offset,
    })
    if (page instanceof Error) throw new CompanyReadUnavailableError(page)

    return context.json(
      {
        data: page.employees.map((employee) => ({
          id: employee.id,
          code: employee.employeeCode,
          name: employee.officialName,
          email: employee.email ?? "",
          status:
            employee.employment?.status === "ACTIVE"
              ? "active"
              : employee.employment?.status === "ON_LEAVE"
                ? "leave"
                : employee.employment?.status === "TERMINATED"
                  ? "retired"
                  : "inactive",
          organization_unit_id: employee.primaryAssignment?.organizationUnitId ?? null,
          organization_unit_code: employee.primaryAssignment?.organizationUnitCode ?? null,
          organization_unit_name: employee.primaryAssignment?.organizationUnitName ?? null,
          position: employee.primaryAssignment?.positionTitle ?? null,
        })),
        total: page.total,
      },
      200,
    )
  },
)
