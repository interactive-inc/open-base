import { resolveCompanyRecordedAt } from "@/contexts/company/interface/request-environment/resolve-company-recorded-at"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
/** /company/profile */
import { CreateCompanyProfile } from "@/contexts/company/application/profile/create-company-profile"
import { DeleteCompanyProfile } from "@/contexts/company/application/profile/delete-company-profile"
import { UpdateCompanyProfile } from "@/contexts/company/application/profile/update-company-profile"
import {
  CompanyResourceValidationError,
  CompanySnapshotRevisionError,
} from "@/contexts/company/domain/errors"
import type { CompanyJsonObject } from "@/contexts/company/domain/entities/company-resource.entity"
import { isCalendarDate } from "@/contexts/company/domain/definitions/is-calendar-date.definition"
import { CompanyResourceEntity } from "@/contexts/company/domain/entities/company-resource.entity"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyCommandConflictError,
  CompanyDatabaseUnavailableError,
  CompanyEffectiveDateQueryConflictError,
  CompanyHeadersInvalidError,
  CompanyInvariantValidationError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
  CompanyResourceConflictError,
  CompanyResourceOrganizationMismatchError,
  CompanyRevisionConflictError,
  CompanyWriteUnavailableError,
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
    const explicitDate = requestQuery.effective_on ?? requestQuery.as_of
    const clock = context.var.companyClock
    if (explicitDate === undefined && clock === undefined)
      throw new CompanyReadUnavailableError(new Error("Company clock is unavailable"))
    const effectiveOn =
      explicitDate ??
      resolveCompanyBusinessDate({
        now: clock?.().toISOString() ?? "",
        timeZone: context.env.COMPANY_TIME_ZONE,
      })
    if (effectiveOn instanceof Error) throw new CompanyReadUnavailableError(effectiveOn)
    const query = {
      organizationId: headers["x-company-organization-id"],
      organizationRevision: requestQuery.organization_revision,
      types: ["legal-entity", "company-profile"] as const,
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
      (!actor.capabilities.includes("company:admin") &&
        !actor.capabilities.includes("company:read"))
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

// @authorization service
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.string().regex(/^\S{1,255}$/),
      "idempotency-key": z.string().regex(/^\S{1,255}$/),
      "if-match": z.string().regex(/^(?:W\/)?(?:"\d+"|\d+)$/),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyHeadersInvalidError(validation.error)
      }
    },
  ),
  zValidator(
    "json",
    z.object({
      reason: z.string().trim().min(1).max(2_000),
      evidenceReferences: z
        .array(
          z.strictObject({
            context: z.string().trim().min(1).max(100),
            kind: z.string().trim().min(1).max(100),
            id: z.string().trim().min(1).max(512),
            version: z.string().trim().min(1).max(255),
          }),
        )
        .max(100)
        .optional(),
      corrections: z
        .array(
          z.strictObject({
            type: z.enum(["legal-entity", "company-profile"]),
            id: z.string().regex(/^\S{1,255}$/),
            revision: z.number().int().min(2),
            correctsRevision: z.number().int().min(1),
          }),
        )
        .max(100)
        .optional(),
      resources: z
        .array(
          z.discriminatedUnion("type", [
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("legal-entity"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  officialName: z.string().trim().min(1).max(2_000),
                  jurisdictionCountryCode: z.string().regex(/^[A-Z]{2}$/),
                  registrationNumber: z.string().trim().min(1).max(255).nullable(),
                  defaultCurrencyCode: z.string().regex(/^[A-Z]{3}$/),
                })
                .strict(),
            }),
            z.object({
              organizationId: z.string().regex(/^\S{1,255}$/),
              type: z.literal("company-profile"),
              id: z.string().regex(/^\S{1,255}$/),
              revision: z.number().int().min(1),
              state: z.enum(["active", "void"]),
              effectiveFrom: z.string().date(),
              effectiveTo: z.string().date().nullable(),
              attributes: z
                .object({
                  displayName: z.string().trim().min(1).max(2_000),
                  representativeName: z.string().trim().min(1).max(2_000).optional(),
                  locale: z.string().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/),
                  timeZone: z.string().regex(/^(?:UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/),
                  fiscalYearStartMonth: z.number().int().min(1).max(12),
                })
                .strict(),
            }),
          ]),
        )
        .min(1)
        .max(100),
    }),
    (validation) => {
      if (!validation.success) {
        throw new CompanyBodyInvalidError(validation.error)
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
    const body = context.req.valid("json")
    const organizationId = headers["x-company-organization-id"]
    if (body.resources.some((resource) => resource.organizationId !== organizationId)) {
      throw new CompanyResourceOrganizationMismatchError()
    }

    const change = {
      commandId: headers["idempotency-key"],
      expectedRevision: Number(headers["if-match"].replace(/^W\//, "").replace(/^"|"$/g, "")),
      reason: body.reason,
      evidenceReferences: body.evidenceReferences,
      corrections: body.corrections,
      recordedAt: resolveCompanyRecordedAt(context.var.companyClock),
      resources: body.resources.map((resource) => ({
        ...resource,
        effectiveFrom: restoreCalendarDate(resource.effectiveFrom),
        effectiveTo:
          resource.effectiveTo === null ? null : restoreCalendarDate(resource.effectiveTo),
        attributes: resource.attributes as CompanyJsonObject,
      })),
    }
    const applicationContext = {
      actor,
      repository: new D1CompanyResourceRepository({ database }),
    }
    let operation: CreateCompanyProfile | UpdateCompanyProfile | DeleteCompanyProfile | null = null
    if (
      body.resources.every((resource) => resource.revision === 1 && resource.state === "active")
    ) {
      operation = new CreateCompanyProfile(applicationContext)
    } else if (
      body.resources.every((resource) => resource.revision > 1 && resource.state === "active")
    ) {
      operation = new UpdateCompanyProfile(applicationContext)
    } else if (
      body.resources.every((resource) => resource.revision > 1 && resource.state === "void")
    ) {
      operation = new DeleteCompanyProfile(applicationContext)
    } else {
      throw new CompanyInvariantValidationError("invalid_change")
    }

    const result = await operation.execute(change)

    if (result.kind === "forbidden") {
      throw new CompanyAccessDeniedError()
    }
    if (result.kind === "invalid") {
      throw new CompanyInvariantValidationError(result.error.code, result.error)
    }
    if (result.kind === "conflict") {
      throw new CompanyRevisionConflictError(`"${result.actualRevision}"`)
    }
    if (result.kind === "resource_conflict") {
      throw new CompanyResourceConflictError()
    }
    if (result.kind === "command_conflict") {
      throw new CompanyCommandConflictError()
    }
    if (result.kind === "unavailable") {
      throw new CompanyWriteUnavailableError(result.cause)
    }

    context.header("etag", `"${result.organizationRevision}"`)

    return context.json(
      {
        organizationId,
        organizationRevision: result.organizationRevision,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
