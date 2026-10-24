import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
/** /company/employee-lifecycle/:code/state */
import { GetLifecycleState } from "@/contexts/company/interface/operations/employee-lifecycle/get-lifecycle-state"
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
import { toLifecycleAssignmentResponse } from "@/contexts/company/interface/operations/to-lifecycle-assignment-response"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - 本人またはemployee:readで現在の人事状態を読む
export const GET = factory.createHandlers(
  zValidator("param", z.object({ code: z.string().trim().min(1).max(64) })),
  zValidator("query", z.object({ as_of: z.string().date().optional() }), (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
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
    const asOf = context.req.valid("query").as_of
    const employee = await new EmployeeRepository(companyContext).find({
      code: context.req.valid("param").code,
      asOf: asOf === undefined ? undefined : restoreCalendarDate(asOf),
    })
    if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
    if (employee === null) {
      throw new CompanyEmployeeNotFoundError()
    }
    if (actor.employeeId !== employee.id && !actor.hasPermission("employee:read")) {
      throw new CompanyReadForbiddenError()
    }
    const state = await new GetLifecycleState(companyContext).run({
      employeeId: employee.id,
      asOf: context.req.valid("query").as_of,
    })
    if (state instanceof CompanyOperationError) throw toHttpException(state)
    return context.json(
      {
        employee_code: state.employeeCode,
        as_of: state.asOf,
        status: state.status,
        employment_period_id: state.employmentPeriodId,
        primary_assignment:
          state.primaryAssignment === null
            ? null
            : toLifecycleAssignmentResponse(state.primaryAssignment),
        concurrent_assignments: state.concurrentAssignments.map(toLifecycleAssignmentResponse),
        responsibility_department_codes: state.responsibilityDepartmentCodes,
        employee_revision: state.employeeRevision,
        organization_revision: state.organizationRevision,
      },
      200,
    )
  },
)
