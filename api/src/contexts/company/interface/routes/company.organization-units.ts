/** /company/organization-units */
import { CreateOrganizationUnit } from "@/contexts/company/application/organization/create-organization-unit"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { CurrentOrganizationReadModelAdapter } from "@/contexts/company/infrastructure/adapters/organization/current-organization-read-model.adapter"
import { OrganizationWorkforceChangeRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-workforce-change.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyDatabaseUnavailableError,
  CompanyIdempotencyKeyRequiredError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - Company Actor の company:read capabilityで組織単位を読む
export const GET = factory.createHandlers(async (context) => {
  const actor = context.var.companyActor
  if (actor === undefined) throw new CompanyAuthenticationRequiredError()
  if (
    !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
    !actor.hasCapability("company:read")
  )
    throw new CompanyReadForbiddenError()
  if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()

  const organization = await new CurrentOrganizationReadModelAdapter({
    env: {
      DB: context.env.DB,
      COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
      ...(context.var.companyClock === undefined
        ? {}
        : { NOW: context.var.companyClock().toISOString() }),
    },
    var: { database: context.var.database, auditContext: context.var.auditContext },
  }).loadCurrentOrganization()
  if (organization instanceof Error) throw new CompanyReadUnavailableError(organization)

  return context.json(
    organization.departments.map((unit) => ({
      id: unit.id,
      code: unit.code,
      name: unit.name,
      parent_code: unit.parentCode,
      manager_employee_code: organization.managerByDepartmentCode.get(unit.code) ?? null,
      organization_revision: organization.organizationRevision,
      as_of: organization.asOf,
    })),
    200,
  )
})

// @authorization permission - org:writeで組織単位を新設する
export const POST = factory.createHandlers(
  zValidator(
    "json",
    z.object({
      code: z.string().trim().min(1).max(64),
      name: z.string().trim().min(1).max(200),
      parent_code: z.string().trim().min(1).max(64).nullable().optional(),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyBodyInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const operationId = context.req.header("Idempotency-Key")
    if (operationId === undefined) {
      throw new CompanyIdempotencyKeyRequiredError()
    }
    const company = {
      env: {
        DB: context.env.DB,
        COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE,
        NOW: context.env.NOW,
      },
      var: { database: context.var.database, auditContext: context.var.auditContext },
    }
    const body = context.req.valid("json")
    const result = await new CreateOrganizationUnit({
      actor,
      company,
      repository: new OrganizationWorkforceChangeRepository(company),
    }).execute({
      operationId,
      code: body.code,
      officialName: body.name,
      parentCode: body.parent_code ?? null,
      now: context.var.companyClock?.() ?? new Date(),
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.json(
      {
        id: result.id,
        code: result.code,
        name: result.name,
        parent_code: result.parentCode,
        manager_employee_code: null,
      },
      result.replayed ? 200 : 201,
    )
  },
)
