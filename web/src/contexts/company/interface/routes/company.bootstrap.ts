import { InitializeCompany } from "@/contexts/company/application/organization/initialize-company"
import { CompanyBootstrapRepository } from "@/contexts/company/infrastructure/repositories/organization/company-bootstrap.repository"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import {
  CompanyAuthenticationRequiredError,
  CompanyBootstrapInputInvalidError,
  CompanyBootstrapUnavailableError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"
const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service - 既定Companyの管理者が確認済み初期事実を保存する
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "idempotency-key": z.string().regex(/^\S{1,200}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "json",
    z
      .object({
        name: z.string().trim().min(1).max(200),
        code: z.string().trim().min(1).max(64),
        organization_name: z.string().trim().min(1).max(200),
        representative_name: z.string().trim().min(1).max(200),
        initial_responsibilities: z.array(z.enum(["MANAGER", "PEOPLE_OPERATIONS"])).max(2),
        hire_date: z.string().date(),
        employment_type: z.enum(["FULL_TIME", "PART_TIME"]),
        locale: z.string(),
        time_zone: z.string(),
        fiscal_year_start_month: z.number().int().min(1).max(12),
        reason: z.string().trim().min(1).max(1000),
      })
      .strict(),
    (validation) => {
      if (!validation.success) throw new CompanyBootstrapInputInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    const database = context.env.DB
    if (database === undefined) throw new CompanyDatabaseUnavailableError()
    const clock = context.var.companyClock
    if (clock === undefined)
      throw new CompanyBootstrapUnavailableError(new Error("Company clock is unavailable"))
    const body = context.req.valid("json")
    const result = await new InitializeCompany({
      actor,
      repository: new CompanyBootstrapRepository({
        env: { DB: database, COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE },
      }),
      now: clock(),
      timeZone: context.env.COMPANY_TIME_ZONE,
    }).execute({
      commandId: context.req.valid("header")["idempotency-key"],
      employeeName: body.name,
      employeeCode: body.code,
      organizationName: body.organization_name,
      representativeName: body.representative_name,
      initialResponsibilities: body.initial_responsibilities,
      effectiveOn: body.hire_date,
      employmentType: body.employment_type,
      locale: body.locale,
      timeZone: body.time_zone,
      fiscalYearStartMonth: body.fiscal_year_start_month,
      reason: body.reason,
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json(
      {
        account_id: actor.accountId,
        employee_id: result.employeeId,
        organization_revision: result.organizationRevision,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
