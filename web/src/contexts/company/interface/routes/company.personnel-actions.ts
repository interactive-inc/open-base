import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"
import { CompanyPersonnelHistoryRepository } from "@/contexts/company/infrastructure/repositories/employee-lifecycle/company-personnel-history.repository"
import { CompanyValidationError } from "@/contexts/company/domain/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyQueryInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - 既定organizationのemployee:readで確定した人事発令を読む
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z
      .object({
        employee_id: z
          .string()
          .regex(/^\S{1,255}$/)
          .optional(),
        id: z
          .string()
          .regex(/^\S{1,255}$/)
          .optional(),
        from: z.string().date().optional(),
        to: z.string().date().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        cursor: z.string().min(1).max(2048).optional(),
      })
      .strict()
      .refine(
        (query) => query.from === undefined || query.to === undefined || query.from <= query.to,
      ),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !actor.hasPermission("employee:read")
    )
      throw new CompanyReadForbiddenError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const query = context.req.valid("query")
    const result = await new CompanyPersonnelHistoryRepository({
      env: { DB: context.env.DB },
    }).list({
      employeeId: query.employee_id ?? null,
      id: query.id ?? null,
      from: query.from ?? null,
      to: query.to ?? null,
      limit: query.limit,
      cursor: query.cursor ?? null,
    })
    if (result instanceof CompanyValidationError) throw new CompanyQueryInvalidError(result)
    if (result instanceof Error) throw new CompanyReadUnavailableError(result)
    const employees = await new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: context.env.DB,
        NOW: context.env.NOW,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
      },
    }).findForEmployeeIds(
      result.data.map((event) => restoreWorkforceId("employee", event.employeeId)),
    )
    if (employees instanceof Error) throw new CompanyReadUnavailableError(employees)
    const employeeById = new Map(employees.map((employee) => [String(employee.id), employee]))
    context.header("Cache-Control", "private, no-store")
    return context.json(
      {
        data: result.data.map((event) => ({
          id: event.id,
          employee_id: event.employeeId,
          kind: event.kind,
          current_employee: employeeById.has(event.employeeId)
            ? {
                code: employeeById.get(event.employeeId)?.employeeCode ?? null,
                name: employeeById.get(event.employeeId)?.officialName ?? null,
              }
            : null,
          event_on: event.eventOn,
          recorded_at: new Date(event.recordedAt * 1000).toISOString(),
          recorded_by_account_id: event.recorded_by_account_id,
          requested_by_employee_id: event.requested_by_employee_id,
          source_type: event.source_type,
          source_application_id: event.source_application_id,
          corrects_action_id: event.correctsActionId,
          corrected_by_action_id: event.correctedByActionId,
          summary: event.summary,
        })),
        next_cursor: result.nextCursor,
      },
      200,
    )
  },
)
