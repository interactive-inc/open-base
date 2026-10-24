/** /company/personnel-annotations */
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { PersonnelAnnotationRepository } from "@/contexts/company/infrastructure/repositories/employee-history/personnel-annotation.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyEmployeeNotFoundError,
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

// @authorization permission - 本人またはemployee:readで履歴を読む
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z
      .object({
        employee_code: z.string().trim().min(1).max(64).optional(),
        employee_id: z.string().optional(),
        kind: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(100),
        offset: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
      })
      .refine((query) => (query.employee_code === undefined) !== (query.employee_id === undefined)),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const query = context.req.valid("query")
    if (
      !actor.organizationIds.includes(COMPANY_DEFAULT_ORGANIZATION_ID) &&
      !actor.organizationIds.includes("*")
    )
      throw new CompanyReadForbiddenError()
    let employeeId = query.employee_id
    if (query.employee_code !== undefined) {
      const directory = new CompanyEmployeeDirectoryReadAdapter({
        env: {
          DB: context.env.DB,
          COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
          ...(context.var.companyClock === undefined
            ? {}
            : { NOW: context.var.companyClock().toISOString() }),
        },
      })
      const employee = await directory.findByCode(query.employee_code)
      if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
      if (employee === null) throw new CompanyEmployeeNotFoundError()
      employeeId = employee.id
    }
    if (
      employeeId === undefined ||
      (actor.employeeId !== employeeId && !actor.hasPermission("employee:read"))
    )
      throw new CompanyReadForbiddenError()
    const repository = new PersonnelAnnotationRepository({
      env: { DB: context.env.DB },
      var: { database: context.var.database, auditContext: context.var.auditContext },
    })
    const [events, total] = await Promise.all([
      repository.findMany({
        employeeId,
        kind: query.kind ?? null,
        limit: query.limit,
        offset: query.offset,
      }),
      repository.countByEmployeeId({ employeeId, kind: query.kind ?? null }),
    ])
    if (events instanceof Error || total instanceof Error) {
      throw new CompanyReadUnavailableError(events instanceof Error ? events : total)
    }
    return context.json(
      {
        data: events.map((event) => {
          const props = event.toProps()
          return {
            id: props.id,
            employee_id: props.employeeId,
            kind: props.kind,
            effective_date: props.effectiveDate,
            from_department_code: props.fromDepartmentCode,
            to_department_code: props.toDepartmentCode,
            note: props.note,
            created_at: props.createdAt,
          }
        }),
        total,
      },
      200,
    )
  },
)
