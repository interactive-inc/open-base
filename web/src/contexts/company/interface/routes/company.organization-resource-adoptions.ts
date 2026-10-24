import { ApplyOrganizationResourceAdoption } from "@/contexts/company/application/organization/apply-organization-resource-adoption"
import { CompanyNotFoundError, CompanyOperationError } from "@/contexts/company/domain/errors"
import { OrganizationResourceAdoptionSnapshotAdapter } from "@/contexts/company/infrastructure/adapters/organization/organization-resource-adoption-snapshot.adapter"
import { OrganizationResourceAdoptionRepository } from "@/contexts/company/infrastructure/repositories/organization/organization-resource-adoption.repository"
import { resolveCompanyBusinessDate } from "@/contexts/company/domain/definitions/resolve-company-business-date.definition"
import {
  CompanyAuthenticationRequiredError,
  CompanyAccessDeniedError,
  CompanyDatabaseUnavailableError,
  CompanyReadUnavailableError,
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

// @authorization service - 既定organizationのCompany管理者が既存組織の全履歴を確認する
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z
      .object({ organization_unit_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/) })
      .strict(),
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
    const snapshot = await new OrganizationResourceAdoptionSnapshotAdapter(context.env.DB).find(
      context.req.valid("query").organization_unit_id,
    )
    if (snapshot instanceof Error) throw new CompanyReadUnavailableError(snapshot)
    if (snapshot === null)
      throw toHttpException(
        new CompanyNotFoundError("組織が見つかりません", "organization_unit_not_found"),
      )
    return context.json({
      snapshot: snapshot.props.value,
      snapshotDigest: snapshot.props.digest,
      expectedRevision: snapshot.props.value.organizationRevision ?? 0,
      observedOn,
    })
  },
)

// @authorization service - Company管理者が確認した組織履歴を接続する
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
        organizationUnitId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
        expectedRevision: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 100),
        snapshotDigest: z.string().regex(/^[a-f0-9]{64}$/),
        observedOn: z.string().date(),
        reason: z.string().trim().min(1).max(1000),
        initializationConfirmation: z
          .object({
            startsOn: z.string().date(),
            evidenceReferences: z
              .array(
                z
                  .object({
                    context: z.string().trim().min(1).max(100),
                    kind: z.string().trim().min(1).max(100),
                    id: z.string().trim().min(1).max(512),
                    version: z.string().trim().min(1).max(255),
                  })
                  .strict(),
              )
              .min(1)
              .max(20),
          })
          .strict()
          .optional(),
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
    const applied = await new ApplyOrganizationResourceAdoption({
      actor,
      repository: new OrganizationResourceAdoptionRepository({
        env: { DB: context.env.DB, COMPANY_TIME_ZONE: context.env.COMPANY_TIME_ZONE },
      }),
      now: context.var.companyClock?.() ?? new Date(),
    }).execute({
      ...context.req.valid("json"),
      commandId: context.req.valid("header")["idempotency-key"],
    })
    if (applied instanceof CompanyOperationError) throw toHttpException(applied)
    return context.json(applied, applied.replayed ? 200 : 201)
  },
)
