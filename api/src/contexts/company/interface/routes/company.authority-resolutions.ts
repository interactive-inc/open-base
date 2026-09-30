import { CompanyAuthoritySnapshotGuardAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-authority-snapshot-guard.adapter"
import { CompanyDecisionParticipantsAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-decision-participants.adapter"
import { restoreCalendarDate } from "@/contexts/company/domain/definitions/restore-calendar-date.definition"
import { CompanyGovernanceAuthorityResolutionAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-governance-authority-resolution.adapter"
import { CompanyDecisionHumanAccountsAdapter } from "@/contexts/company/infrastructure/adapters/organization/company-decision-human-accounts.adapter"
import { D1CompanyResourceRepository } from "@/contexts/company/infrastructure/repositories/core/d1-company-resource.repository"
import {
  CompanyAccessDeniedError,
  CompanyApplicationConflictError,
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

const scope = z.discriminatedUnion("scope_type", [
  z
    .object({
      scope_type: z.enum(["organization-unit", "legal-entity", "site", "workplace"]),
      scope_id: z.string().regex(/^\S{1,255}$/),
    })
    .strict(),
  z
    .object({
      scope_type: z.literal("region"),
      region_code: z.string().trim().min(1).max(255),
    })
    .strict(),
  z
    .object({
      scope_type: z.literal("amount"),
      currency_code: z.string().regex(/^[A-Z]{3}$/),
      amount: z.number().finite().nonnegative(),
    })
    .strict(),
])

// @authorization service - technical permissionと分離したCompany上の責務候補をsnapshotで解決する
export const POST = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "x-company-organization-id": z.string().regex(/^\S{1,255}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "json",
    z
      .object({
        as_of: z.string().date(),
        subject_employee_id: z
          .string()
          .regex(/^\S{1,255}$/)
          .nullable(),
        criteria: z
          .array(
            z
              .object({
                responsibility_code: z.string().trim().min(1).max(255),
                scope: scope.nullable(),
              })
              .strict(),
          )
          .min(1)
          .max(20),
      })
      .strict(),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    const database = context.env.DB
    if (database === undefined) throw new CompanyDatabaseUnavailableError()
    const organizationId = context.req.valid("header")["x-company-organization-id"]
    if (
      (!actor.organizationIds.includes(organizationId) && !actor.organizationIds.includes("*")) ||
      (!actor.capabilities.includes("company:admin") &&
        !actor.capabilities.includes("company:read"))
    ) {
      throw new CompanyAccessDeniedError()
    }
    const body = context.req.valid("json")
    const snapshotGuard = new CompanyAuthoritySnapshotGuardAdapter({ database })
    const before = await snapshotGuard.findSnapshot()
    if (before instanceof Error) throw new CompanyReadUnavailableError(before)
    const resolvedAt = context.var.companyClock?.() ?? new Date(context.env.NOW ?? Date.now())
    const result = await new CompanyGovernanceAuthorityResolutionAdapter({
      repository: new D1CompanyResourceRepository({ database }),
      readActiveAccountIds: async (accountIds) => {
        return new CompanyDecisionHumanAccountsAdapter({ database }).findMany(
          accountIds,
          resolvedAt,
        )
      },
    }).resolve({
      organizationId,
      asOf: restoreCalendarDate(body.as_of),
      subjectEmployeeId: body.subject_employee_id,
      criteria: body.criteria.map((criterion) => ({
        responsibilityCode: criterion.responsibility_code,
        scope:
          criterion.scope === null
            ? null
            : criterion.scope.scope_type === "region"
              ? {
                  scopeType: "region" as const,
                  regionCode: criterion.scope.region_code,
                }
              : criterion.scope.scope_type === "amount"
                ? {
                    scopeType: "amount" as const,
                    currencyCode: criterion.scope.currency_code,
                    amount: criterion.scope.amount,
                  }
                : {
                    scopeType: criterion.scope.scope_type,
                    scopeId: criterion.scope.scope_id,
                  },
      })),
    })
    if (result.kind === "unavailable") throw new CompanyReadUnavailableError(result.cause)
    if (result.kind === "invalid") {
      throw new CompanyApplicationConflictError(result.error.code, result.error.message)
    }

    const participants = await new CompanyDecisionParticipantsAdapter({
      env: { DB: database },
    }).validate({
      candidates: result.resolution.candidates,
      asOf: restoreCalendarDate(body.as_of),
      resolvedAt,
    })
    if (participants instanceof Error) throw new CompanyReadUnavailableError(participants)

    const after = await snapshotGuard.findSnapshot()
    if (after instanceof Error) throw new CompanyReadUnavailableError(after)
    if (before !== after)
      throw new CompanyApplicationConflictError(
        "company_authority_snapshot_changed",
        "会社の資格情報が変更されました。再度照会してください",
      )

    context.header("etag", `"${result.resolution.snapshot.organizationRevision}"`)
    return context.json(result.resolution, 200)
  },
)
