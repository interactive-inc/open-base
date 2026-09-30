/** /company/organization-units/:code */
import { DeleteOrganizationUnit } from "@/contexts/company/application/organization/delete-organization-unit"
import { UpdateOrganizationUnit } from "@/contexts/company/application/organization/update-organization-unit"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import { CurrentOrganizationReadModelAdapter } from "@/contexts/company/infrastructure/adapters/organization/current-organization-read-model.adapter"
import { OrganizationWorkforceChangeRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-workforce-change.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyDatabaseUnavailableError,
  CompanyIdempotencyKeyRequiredError,
  CompanyOrganizationUnitNotFoundError,
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

// @authorization permission - company:read capabilityで組織単位を読む
export const GET = factory.createHandlers(
  zValidator("param", z.object({ code: z.string().trim().min(1).max(64) }), (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  async (context) => {
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
    const unit = organization.departments.find(
      (candidate) => candidate.code === context.req.valid("param").code,
    )
    if (unit === undefined) {
      throw new CompanyOrganizationUnitNotFoundError()
    }

    return context.json(
      {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        parent_code: unit.parentCode,
        manager_employee_code: organization.managerByDepartmentCode.get(unit.code) ?? null,
        organization_revision: organization.organizationRevision,
        as_of: organization.asOf,
      },
      200,
    )
  },
)

// @authorization permission - org:writeで組織単位の訂正revisionを追記する
export const PUT = factory.createHandlers(
  zValidator("param", z.object({ code: z.string().trim().min(1).max(64) }), (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  zValidator(
    "json",
    z.object({
      expected_organization_revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      expected_as_of: z.iso.date(),
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
    const result = await new UpdateOrganizationUnit({
      actor,
      company,
      repository: new OrganizationWorkforceChangeRepository(company),
    }).execute({
      operationId,
      code: context.req.valid("param").code,
      expectedOrganizationRevision: body.expected_organization_revision,
      expectedAsOf: body.expected_as_of,
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
      200,
    )
  },
)

// @authorization permission - org:writeで組織単位の無効化revisionを追記する
export const DELETE = factory.createHandlers(
  zValidator("param", z.object({ code: z.string().trim().min(1).max(64) }), (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  zValidator(
    "json",
    z.object({
      expected_organization_revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
      expected_as_of: z.iso.date(),
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
    const result = await new DeleteOrganizationUnit({
      actor,
      company,
      repository: new OrganizationWorkforceChangeRepository(company),
    }).execute({
      operationId,
      expectedOrganizationRevision: body.expected_organization_revision,
      expectedAsOf: body.expected_as_of,
      code: context.req.valid("param").code,
      now: context.var.companyClock?.() ?? new Date(),
    })
    if (result instanceof CompanyOperationError) throw toHttpException(result)
    return context.body(null, 204)
  },
)
