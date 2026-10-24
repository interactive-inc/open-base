import { canReadCompanyResource } from "@/contexts/company/interface/operations/company-resource-read-permission"
import {
  CompanyResourceValidationError,
  CompanySnapshotRevisionError,
} from "@/contexts/company/domain/errors"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyQueryInvalidError,
  CompanyEffectiveDateQueryConflictError,
  CompanyAccessDeniedError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service
export const GET = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.string().regex(/^\S{1,255}$/),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHeadersInvalidError(validation.error)
      }
    },
  ),
  zValidator(
    "query",
    z.object({
      id: z
        .union([z.string().regex(/^\S{1,255}$/), z.array(z.string().regex(/^\S{1,255}$/)).max(100)])
        .optional(),
      organization_revision: z
        .string()
        .regex(/^(0|[1-9]\d*)$/)
        .transform(Number)
        .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER))
        .optional(),
      effective_on: z.string().date().optional(),
      as_of: z.string().date().optional(),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyQueryInvalidError(validation.error)
      }
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) {
      throw new CompanyAuthenticationRequiredError()
    }

    const database = context.env.DB
    if (database === undefined) {
      throw new CompanyDatabaseUnavailableError()
    }

    const headers = context.req.valid("header")
    const requestQuery = context.req.valid("query")
    if (
      requestQuery.effective_on !== undefined &&
      requestQuery.as_of !== undefined &&
      requestQuery.effective_on !== requestQuery.as_of
    ) {
      throw new CompanyEffectiveDateQueryConflictError()
    }

    const ids =
      requestQuery.id === undefined
        ? []
        : Array.isArray(requestQuery.id)
          ? requestQuery.id
          : [requestQuery.id]
    const effectiveOn = requestQuery.effective_on ?? requestQuery.as_of
    const query = {
      organizationId: headers["x-company-organization-id"],
      organizationRevision: requestQuery.organization_revision,
      types: ["personnel-action"] as const,
      ...(ids.length === 0 ? {} : { ids }),
      ...(effectiveOn === undefined ? {} : { effectiveOn: restoreCalendarDate(effectiveOn) }),
    }
    if (
      !CompanyResourceEntity.isIdentifier(query.organizationId) ||
      query.types.length < 1 ||
      query.types.length > 100 ||
      new Set(query.types).size !== query.types.length ||
      (query.ids !== undefined &&
        (query.ids.length < 1 ||
          query.ids.length > 100 ||
          new Set(query.ids).size !== query.ids.length ||
          !query.ids.every((id) => CompanyResourceEntity.isIdentifier(id)))) ||
      (query.effectiveOn !== undefined && !isCalendarDate(query.effectiveOn))
    ) {
      throw new CompanyQueryInvalidError(new CompanyResourceValidationError("invalid_query"))
    }
    if (
      (!actor.organizationIds.includes(query.organizationId) &&
        !actor.organizationIds.includes("*")) ||
      !canReadCompanyResource(actor, "personnel-action")
    ) {
      throw new CompanyAccessDeniedError()
    }

    const result = await new D1CompanyResourceRepository({ database }).findMany(query)
    if (!result.ok) {
      if (result.cause instanceof CompanySnapshotRevisionError)
        throw new CompanyQueryInvalidError(result.cause)
      throw new CompanyReadUnavailableError(result.cause)
    }

    context.header("etag", `"${result.organizationRevision}"`)

    return context.json(
      {
        organizationId: query.organizationId,
        organizationRevision: result.organizationRevision,
        resources: result.resources,
      },
      200,
    )
  },
)
