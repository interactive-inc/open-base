import { CompleteWorkforceConnection } from "@/contexts/company/application/employees/complete-workforce-connection"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { WorkforceConnectionCompletionRepository } from "@/contexts/company/infrastructure/repositories/employee/workforce-connection-completion.repository"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import {
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - Company管理者だけが接続の状態と完了の記録を読む
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) throw new CompanyAuthenticationRequiredError()
  if (
    !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
    !actor.hasCapability("company:admin")
  )
    throw new CompanyReadForbiddenError()
  const database = context.env.DB
  if (database === undefined) throw new CompanyDatabaseUnavailableError()
  const status = await new WorkforceConnectionCompletionRepository(database).status()
  if (status instanceof Error) throw new CompanyReadUnavailableError(status)
  return context.json(status)
})

// @authorization service - Company管理資格と全件の接続をapplicationとDBで再検査して一度だけ記録する
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "idempotency-key": z.string().regex(/^\S{1,255}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "json",
    z.object({ reason: z.string().trim().min(1).max(2000) }).strict(),
    (validation) => {
      if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    const database = context.env.DB
    if (database === undefined) throw new CompanyDatabaseUnavailableError()
    const clock = context.var.companyClock
    const result = await new CompleteWorkforceConnection({
      actor,
      repository: new WorkforceConnectionCompletionRepository(database),
      now: clock === undefined ? new Date() : clock(),
    }).execute({
      commandId: context.req.valid("header")["idempotency-key"],
      reason: context.req.valid("json").reason,
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    const { replayed, ...completion } = result
    return context.json(completion, replayed ? 200 : 201)
  },
)
