/** /company/employee-directory/:code */
import { UpdateEmployeeName } from "@/contexts/company/application/employees/update-employee-name"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { CompanyEmployeeDirectoryReadAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-directory-read.adapter"
import { EmployeeProfileRepository } from "@/contexts/company/infrastructure/repositories/employee/employee-profile.repository"
import { EmployeeProfileSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee/employee-profile-snapshot.adapter"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import {
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyHeadersInvalidError,
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
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()
const paramSchema = z.object({ code: z.string().trim().min(1).max(64) })

// @authorization permission - employee:readで従業員詳細を読む
export const GET = factory.createHandlers(
  zValidator("param", paramSchema, (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !actor.hasPermission("employee:read")
    )
      throw new CompanyReadForbiddenError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const employee = await new CompanyEmployeeDirectoryReadAdapter({
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        ...(context.var.companyClock === undefined
          ? {}
          : { NOW: context.var.companyClock().toISOString() }),
      },
    }).findByCode(context.req.valid("param").code)
    if (employee instanceof Error) throw new CompanyReadUnavailableError(employee)
    if (employee === null || employee.employeeCode === null) {
      throw new CompanyEmployeeNotFoundError()
    }
    const effectiveOn = resolveCompanyBusinessDate({
      now: (context.var.companyClock?.() ?? new Date()).toISOString(),
      timeZone: context.env.COMPANY_TIME_ZONE,
    })
    if (effectiveOn instanceof Error) throw new CompanyReadUnavailableError(effectiveOn)
    const profile = await new EmployeeProfileSnapshotAdapter(context.env.DB).find({
      employeeId: employee.id,
      effectiveOn,
    })
    if (profile instanceof Error) throw new CompanyReadUnavailableError(profile)
    return context.json(
      {
        code: employee.employeeCode,
        name: profile?.person.readText("officialName") ?? employee.officialName,
        profile: profile?.version ?? null,
        dept_name: employee.primaryAssignment?.organizationUnitName ?? null,
        position: employee.primaryAssignment?.positionTitle ?? null,
        email: employee.email ?? "",
        status:
          employee.employment?.status === "ON_LEAVE"
            ? "leave"
            : employee.employment?.status === "TERMINATED"
              ? "retired"
              : "active",
      },
      200,
    )
  },
)

// @authorization permission - employee:write:basicをApplicationで検証する
export const PUT = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "idempotency-key": z.string().regex(/^\S{1,200}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),

  zValidator("param", paramSchema, (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  zValidator(
    "json",
    z
      .object({
        name: z.string().trim().min(1).max(200),
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
    const result = await new UpdateEmployeeName({
      actor,
      repository: new EmployeeProfileRepository({
        env: { DB: context.env.DB, COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE },
      }),
      now: context.var.companyClock?.() ?? new Date(),
    }).execute({
      code: context.req.valid("param").code,
      officialName: context.req.valid("json").name,
      profile: context.req.valid("json").profile,
      reason: context.req.valid("json").reason,
      commandId: context.req.valid("header")["idempotency-key"],
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json(
      {
        code: result.employeeCode,
        name: result.officialName,
        profile: result.profile,
        replayed: result.replayed,
      },
      200,
    )
  },
)
