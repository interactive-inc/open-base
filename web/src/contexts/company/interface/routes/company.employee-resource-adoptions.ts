import { ApplyEmployeeResourceAdoption } from "@/contexts/company/application/employees/apply-employee-resource-adoption"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { EmployeeResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/employee-resource-adoption/employee-resource-adoption-snapshot.adapter"
import { EmployeeResourceAdoptionRepository } from "@/contexts/company/infrastructure/repositories/employee-resource-adoption/employee-resource-adoption.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import {
  CompanyAuthenticationRequiredError,
  CompanyAccessDeniedError,
  CompanyDatabaseUnavailableError,
  CompanyReadUnavailableError,
  CompanyEmployeeNotFoundError,
  CompanyQueryInvalidError,
  CompanyBodyInvalidError,
  CompanyHeadersInvalidError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service - 既定organizationのCompany管理者だけが移行対象の履歴を確認する
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z.object({ employee_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/) }).strict(),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !actor.hasCapability("company:admin")
    )
      throw new CompanyAccessDeniedError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const observedOn = resolveCompanyBusinessDate({
      now: (context.var.companyClock?.() ?? new Date()).toISOString(),
      timeZone: context.env.COMPANY_TIME_ZONE,
    })
    if (observedOn instanceof Error) throw new CompanyReadUnavailableError(observedOn)
    const snapshot = await new EmployeeResourceAdoptionSnapshotAdapter(context.env.DB).find(
      context.req.valid("query").employee_id,
    )
    if (snapshot instanceof Error) throw new CompanyReadUnavailableError(snapshot)
    if (snapshot === null) throw new CompanyEmployeeNotFoundError()
    return context.json(
      {
        snapshot: snapshot.props.value,
        snapshotDigest: snapshot.props.digest,
        expectedRevision: snapshot.props.value.organizationRevision ?? 0,
        observedOn,
      },
      200,
    )
  },
)

// @authorization service - Company管理者が確認した人物履歴と既存雇用を照合して接続する
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
        employeeId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
        expectedRevision: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 100),
        snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
        observedOn: z.string().date(),
        reason: z.string().trim().min(1).max(1500),
        reuseExistingHistory: z.literal(true).optional(),
        resources: z
          .array(
            z
              .object({
                organizationId: z.literal(COMPANY_DEFAULT_ORGANIZATION_ID),
                type: z.enum(["person", "employee", "employment"]),
                id: z.string().regex(/^\S{1,255}$/),
                revision: z.number().int().positive().max(100),
                state: z.enum(["active", "void"]),
                effectiveFrom: z.string().date(),
                effectiveTo: z.string().date().nullable(),
                attributes: z.record(z.string(), z.string().nullable()),
              })
              .strict(),
          )
          .min(2)
          .max(100),
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
    const body = context.req.valid("json")
    const result = await new ApplyEmployeeResourceAdoption({
      actor,
      now: context.var.companyClock?.() ?? new Date(),
      repository: new EmployeeResourceAdoptionRepository({
        env: { DB: context.env.DB, COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE },
      }),
    }).execute({
      ...body,
      commandId: context.req.valid("header")["idempotency-key"],
      observedOn: restoreCalendarDate(body.observedOn),
      resources: body.resources.map((resource) => ({
        ...resource,
        effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
        effectiveTo:
          resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
      })),
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json(
      z
        .object({
          employeeId: z.string(),
          organizationRevision: z.number().int().positive(),
          replayed: z.boolean(),
        })
        .strict()
        .parse(result),
      200,
    )
  },
)
