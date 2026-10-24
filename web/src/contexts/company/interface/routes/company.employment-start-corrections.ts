import { ApplyOrganizationChange } from "@/contexts/company/application/organization/apply-organization-change"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyEmploymentStartCorrectionTargetValue } from "@/contexts/company/domain/values/company-employment-start-correction-target.value"
import {
  CompanySnapshotRevisionError,
  CompanyResourceValidationError,
} from "@/contexts/company/domain/errors"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import { planEmploymentStartCorrection } from "@/contexts/company/interface/operations/plan-employment-start-correction"
import { readEmploymentStartCorrectionHistory } from "@/contexts/company/interface/operations/read-employment-start-correction-history"
import { canReadCompanyResource } from "@/contexts/company/interface/operations/company-resource-read-permission"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyBodyInvalidError,
  CompanyCommandConflictError,
  CompanyDatabaseUnavailableError,
  CompanyEmployeeNotFoundError,
  CompanyHeadersInvalidError,
  CompanyInvariantValidationError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
  CompanyResourceConflictError,
  CompanyRevisionConflictError,
  CompanyWriteUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { resolveCompanyRecordedAt } from "@/contexts/company/interface/request-environment/resolve-company-recorded-at"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

/** 訂正の確認対象となる開始境界と、その元revisionを同じ会社版から返す。 */
// @authorization service
export const GET = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "x-company-organization-id": z.literal(COMPANY_DEFAULT_ORGANIZATION_ID) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "query",
    z.strictObject({
      employment_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
      organization_revision: z
        .string()
        .regex(/^(0|[1-9]\d*)$/)
        .transform(Number)
        .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER))
        .optional(),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !canReadCompanyResource(actor, "employment")
    )
      throw new CompanyAccessDeniedError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const query = context.req.valid("query")
    const history = await readEmploymentStartCorrectionHistory({
      database: context.env.DB,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      employmentId: query.employment_id,
      throughRevision: query.organization_revision,
    })
    if (history === null) throw new CompanyEmployeeNotFoundError()
    if (history instanceof CompanySnapshotRevisionError) throw new CompanyQueryInvalidError(history)
    if (history instanceof Error) throw new CompanyReadUnavailableError(history)
    const target = CompanyEmploymentStartCorrectionTargetValue.create(history.resources)
    if (target instanceof Error) throw new CompanyReadUnavailableError(target)
    context.header("etag", `"${history.organizationRevision}"`)
    return context.json({
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      organizationRevision: history.organizationRevision,
      employmentId: query.employment_id,
      startsOn: target.startsOn,
      correctsRevision: target.correctsRevision,
      latestRevision: target.latestRevision,
    })
  },
)

/** 確認済みの原資料から雇用開始日を訂正し、後続の在籍履歴を保全する。 */
// @authorization service
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.literal(COMPANY_DEFAULT_ORGANIZATION_ID),
      "idempotency-key": z.string().regex(/^\S{1,255}$/),
      "if-match": z.string().regex(/^(?:W\/)?(?:"\d+"|\d+)$/),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "json",
    z
      .object({
        employmentId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/),
        correctsRevision: z.number().int().positive(),
        startsOn: z.string().date(),
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
          .min(1)
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
    if (
      !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !actor.canUpdateWorkforce()
    )
      throw new CompanyAccessDeniedError()
    const database = context.env.DB
    if (database === undefined) throw new CompanyDatabaseUnavailableError()
    const headers = context.req.valid("header")
    const body = context.req.valid("json")
    const expectedRevision = Number(headers["if-match"].replace(/^W\//, "").replace(/^"|"$/g, ""))
    if (!Number.isSafeInteger(expectedRevision))
      throw new CompanyHeadersInvalidError(new Error("Invalid revision"))

    const recordedAt = resolveCompanyRecordedAt(context.var.companyClock)
    const planned = await planEmploymentStartCorrection({
      database,
      organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
      employmentId: body.employmentId,
      expectedRevision,
      correctsRevision: body.correctsRevision,
      startsOn: restoreCalendarDate(body.startsOn),
      commandId: headers["idempotency-key"],
      recordedAt,
    })
    if (planned === null) throw new CompanyEmployeeNotFoundError()
    if (planned instanceof CompanySnapshotRevisionError) throw new CompanyQueryInvalidError(planned)
    if (planned instanceof CompanyResourceValidationError)
      throw new CompanyInvariantValidationError(planned.code, planned)
    if (planned instanceof Error) throw new CompanyReadUnavailableError(planned)
    const result = await new ApplyOrganizationChange({
      actor,
      repository: new D1CompanyResourceRepository({ database }),
    }).execute({
      commandId: headers["idempotency-key"],
      expectedRevision,
      reason: body.reason,
      evidenceReferences: body.evidenceReferences,
      corrections: planned.corrections,
      recordedAt,
      resources: planned.resources,
    })
    if (result.kind === "forbidden") throw new CompanyAccessDeniedError()
    if (result.kind === "invalid")
      throw new CompanyInvariantValidationError(result.error.code, result.error)
    if (result.kind === "conflict")
      throw new CompanyRevisionConflictError(`"${result.actualRevision}"`)
    if (result.kind === "resource_conflict") throw new CompanyResourceConflictError()
    if (result.kind === "command_conflict") throw new CompanyCommandConflictError()
    if (result.kind === "unavailable") throw new CompanyWriteUnavailableError(result.cause)
    context.header("etag", `"${result.organizationRevision}"`)
    return context.json(
      {
        organizationId: COMPANY_DEFAULT_ORGANIZATION_ID,
        organizationRevision: result.organizationRevision,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
