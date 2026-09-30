import { UpdateOrganizationProfile } from "@/contexts/company/application/organization/update-organization-profile"
import { D1OrganizationProfileAdapter } from "@/contexts/company/infrastructure/adapters/organization/d1-organization-profile.adapter"
import { OrganizationProfileChangeRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-profile-change.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import { organizationProfileVersionSchema } from "@/contexts/company/domain/definitions/organization-profile-version.definition"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyOrganizationAmbiguousError,
  CompanyOrganizationProfileInvalidError,
  CompanyOrganizationProfileNotConfiguredError,
  CompanyOrganizationProfileReadFailedError,
  CompanyReadForbiddenError,
  CompanyHeadersInvalidError,
  CompanyOrganizationProfileWriteFailedError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { createFactory } from "hono/factory"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - Company readと一つのorganization scopeで表示時点の情報を読む
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) throw new CompanyAuthenticationRequiredError()
  if (!actor.hasCapability("company:read")) throw new CompanyReadForbiddenError()
  if (actor.organizationIds.length !== 1 || actor.organizationIds[0] === "*")
    throw new CompanyOrganizationAmbiguousError()
  const database = context.env.DB
  if (database === undefined) throw new CompanyDatabaseUnavailableError()
  const clock = context.var.companyClock
  if (clock === undefined)
    throw new CompanyOrganizationProfileReadFailedError(new Error("Company clock is unavailable"))
  const effectiveOn = resolveCompanyBusinessDate({
    now: clock().toISOString(),
    timeZone: context.env.COMPANY_TIME_ZONE,
  })
  if (effectiveOn instanceof Error) throw new CompanyOrganizationProfileReadFailedError(effectiveOn)
  const result = await new D1OrganizationProfileAdapter(database).find(
    actor.organizationIds[0],
    effectiveOn,
  )
  if (result instanceof Error) throw new CompanyOrganizationProfileReadFailedError(result)
  if (result === null) throw new CompanyOrganizationProfileNotConfiguredError()
  context.header("etag", `"${result.props.version.organizationRevision}"`)
  return context.json({
    name: result.name,
    representativeName: result.representativeName,
    locale: result.props.locale,
    timeZone: result.props.timeZone,
    fiscalYearStartMonth: result.props.fiscalYearStartMonth,
    version: result.props.version,
  })
})

// @authorization service - 表示した会社版と営業日を管理資格とともにapplicationへ渡す
export const PUT = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "idempotency-key": z.string().regex(/^\S{1,255}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "json",
    z
      .object({
        name: z.string().trim().min(1).max(2000),
        representativeName: z.string().trim().min(1).max(2000),
        locale: z.string(),
        timeZone: z.string(),
        fiscalYearStartMonth: z.number().int().min(1).max(12),
        version: organizationProfileVersionSchema,
        reason: z.string().trim().min(1).max(2000),
      })
      .strict(),
    (validation) => {
      if (!validation.success) throw new CompanyOrganizationProfileInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    const database = context.env.DB
    if (database === undefined) throw new CompanyDatabaseUnavailableError()
    const clock = context.var.companyClock
    if (clock === undefined)
      throw new CompanyOrganizationProfileWriteFailedError(
        new Error("Company clock is unavailable"),
      )
    const result = await new UpdateOrganizationProfile({
      actor,
      repository: new OrganizationProfileChangeRepository(database),
      now: clock(),
      timeZone: context.env.COMPANY_TIME_ZONE,
    }).execute({
      ...context.req.valid("json"),
      commandId: context.req.valid("header")["idempotency-key"],
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    context.header("etag", `"${result.organizationRevision}"`)
    return context.json(result)
  },
)
