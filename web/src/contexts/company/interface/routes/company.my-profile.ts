/** /company/my-profile */
import { UpdateEmployeePhone } from "@/contexts/company/application/employees/update-employee-phone"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { EmployeeProfileRepository } from "@/contexts/company/infrastructure/repositories/employee/employee-profile.repository"
import { EmployeeProfileSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-profile-snapshot.adapter"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { EmployeeRepository } from "@/contexts/company/infrastructure/repositories/employee/employee.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyHeadersInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
  CompanyEmployeeNotFoundError,
  CompanyDatabaseUnavailableError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization owner - 本人の人物表示と編集対象の版だけを読む
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) throw new CompanyAuthenticationRequiredError()
  if (actor.employeeId === null || !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID))
    throw new CompanyReadForbiddenError()
  if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
  const effectiveOn = resolveCompanyBusinessDate({
    now: (context.var.companyClock?.() ?? new Date()).toISOString(),
    timeZone: context.env.COMPANY_TIME_ZONE,
  })
  if (effectiveOn instanceof Error) throw new CompanyReadUnavailableError(effectiveOn)
  const profile = await new EmployeeProfileSnapshotAdapter(context.env.DB).find({
    employeeId: actor.employeeId,
    effectiveOn,
  })
  if (profile instanceof Error) throw new CompanyReadUnavailableError(profile)
  if (profile !== null)
    return context.json(
      {
        name: profile.person.readText("officialName"),
        phone: profile.person.readNullableText("phone") ?? null,
        profile: profile.version,
      },
      200,
    )
  const employee = await new EmployeeRepository({
    env: { DB: context.env.DB },
    var: { database: context.var.database, auditContext: context.var.auditContext },
  }).find({ id: actor.employeeId, asOf: effectiveOn })
  if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
  if (employee === null) throw new CompanyEmployeeNotFoundError()
  return context.json({ name: employee.officialName, phone: employee.phone, profile: null }, 200)
})

// @authorization owner - 本人のCompany連絡先だけを更新する
export const PUT = factory.createHandlers(
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
        phone: z.string().trim().min(1).max(64).nullable(),
        profile: z
          .object({
            employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
            organizationRevision: z
              .number()
              .int()
              .nonnegative()
              .max(Number.MAX_SAFE_INTEGER - 1),
            personRevision: z
              .number()
              .int()
              .positive()
              .max(Number.MAX_SAFE_INTEGER - 1),
            effectiveOn: z.string().date(),
          })
          .strict(),
        reason: z.string().trim().min(1).max(1500),
      })
      .strict(),
    (validation) => {
      if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const result = await new UpdateEmployeePhone({
      actor,
      repository: new EmployeeProfileRepository({
        env: { DB: context.env.DB, COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE },
      }),
      now: context.var.companyClock?.() ?? new Date(),
    }).execute({
      ...context.req.valid("json"),
      commandId: context.req.valid("header")["idempotency-key"],
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json(
      { phone: result.phone, profile: result.profile, replayed: result.replayed },
      200,
    )
  },
)
