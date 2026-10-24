/** /company/personnel-action-executions */
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { EmployeeRepository } from "@/contexts/company/infrastructure/repositories/employee/employee.repository"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyDatabaseUnavailableError,
  CompanyEmployeeIdentityRequiredError,
  CompanyEmployeeNotFoundError,
  CompanyIdempotencyKeyRequiredError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { dispatchPersonnelAction } from "@/contexts/company/interface/operations/dispatch-personnel-action"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import {
  resolvePersonnelActionInput,
  wirePersonnelActionInputSchema,
} from "@/contexts/company/interface/operations/resolve-personnel-action-input"
import { toCompanyPersonnelSession } from "@/contexts/company/interface/operations/to-company-personnel-session"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()
const requestSchema = z.object({
  action: wirePersonnelActionInputSchema,
  expected_company_revision: z.number().int().nonnegative(),
  expected_employee_revision: z.number().int().nonnegative(),
  expected_organization_revision: z.number().int().nonnegative().nullable(),
})

// @authorization permission - employee:writeへ写像済みの発令権限を各Applicationで検証する
export const POST = factory.createHandlers(
  zValidator("json", requestSchema, (validation) => {
    if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.hasPermission("employee:write") ||
      (!actor.organizationIds.includes(COMPANY_DEFAULT_ORGANIZATION_ID) &&
        !actor.organizationIds.includes("*"))
    ) {
      throw new CompanyAccessDeniedError()
    }
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const session = toCompanyPersonnelSession(actor)
    if (session === null) {
      throw new CompanyEmployeeIdentityRequiredError()
    }
    const idempotencyKey = context.req.header("Idempotency-Key")
    if (idempotencyKey === undefined) {
      throw new CompanyIdempotencyKeyRequiredError()
    }
    const companyContext = {
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        NOW: context.env.NOW,
      },
      var: { database: context.var.database, auditContext: context.var.auditContext },
    }
    const body = context.req.valid("json")
    const action = await resolvePersonnelActionInput(
      companyContext,
      body.action,
      body.expected_company_revision,
    )
    if (action instanceof CompanyOperationError) throw toHttpException(action)
    const employeeCode =
      action.kind === "corrected" ? action.replacementAction.employeeCode : action.employeeCode
    const employee = await new EmployeeRepository(companyContext).find({ code: employeeCode })
    if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
    if (employee === null) {
      throw new CompanyEmployeeNotFoundError()
    }
    const result = await dispatchPersonnelAction(companyContext, {
      session,
      employeeId: employee.id,
      input: action,
      idempotencyKey,
      expectedCompanyRevision: body.expected_company_revision,
      expectedEmployeeRevision: body.expected_employee_revision,
      expectedOrganizationRevision: body.expected_organization_revision,
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json(
      {
        id: result.action.id,
        kind: result.action.kind,
        event_on: result.action.eventOn,
        recorded_at: new Date(result.action.recordedAt * 1_000).toISOString(),
        source_type: result.action.sourceType,
        source_application_id: result.action.sourceApplicationId,
        corrects_action_id: result.action.correctsActionId,
        summary: result.action.summary,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
