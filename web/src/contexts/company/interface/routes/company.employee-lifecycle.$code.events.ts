/** /company/employee-lifecycle/:code/events */
import { EmployeeLifecycleEventListAdapter } from "@/contexts/company/infrastructure/adapters/employee-lifecycle/employee-lifecycle-event-list.adapter"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { EmployeeRepository } from "@/contexts/company/infrastructure/repositories/employee/employee.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyEmployeeNotFoundError,
  CompanyQueryInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - 本人またはemployee:readで人事発令履歴を読む
export const GET = factory.createHandlers(
  zValidator("param", z.object({ code: z.string().trim().min(1).max(64) })),
  zValidator(
    "query",
    z.object({
      from: z.string().date().optional(),
      to: z.string().date().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      cursor: z.string().max(1024).optional(),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const companyContext = {
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        NOW: context.env.NOW,
      },
      var: { database: context.var.database, auditContext: context.var.auditContext },
    }
    const employee = await new EmployeeRepository(companyContext).find({
      code: context.req.valid("param").code,
    })
    if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
    if (employee === null) {
      throw new CompanyEmployeeNotFoundError()
    }
    if (actor.employeeId !== employee.id && !actor.hasPermission("employee:read")) {
      throw new CompanyReadForbiddenError()
    }
    const query = context.req.valid("query")
    const result = await new EmployeeLifecycleEventListAdapter(companyContext).list({
      employeeId: employee.id,
      from: query.from ?? null,
      to: query.to ?? null,
      limit: query.limit,
      cursor: query.cursor ?? null,
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json(
      {
        data: result.data.map((event) => ({
          id: event.id,
          kind: event.kind,
          event_on: event.eventOn,
          recorded_at: new Date(event.recordedAt * 1_000).toISOString(),
          source_type: event.sourceType,
          source_application_id: event.sourceApplicationId,
          corrects_action_id: event.correctsActionId,
          display_status: event.displayStatus,
          summary: event.summary,
        })),
        next_cursor: result.nextCursor,
      },
      200,
    )
  },
)
