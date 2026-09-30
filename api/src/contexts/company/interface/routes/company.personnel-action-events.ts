import { CompanyPersonnelEventRepository } from "@/contexts/company/infrastructure/repositories/employee-lifecycle/company-personnel-event.repository"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import {
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyQueryInvalidError,
  CompanyReadForbiddenError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - 既定organizationのemployee:readで追記順の人事発令を読む
export const GET = factory.createHandlers(
  zValidator(
    "query",
    z
      .object({
        after_sequence: z.coerce
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER)
          .default(0),
        limit: z.coerce.number().int().min(1).max(100).default(25),
        recorded_since: z.iso
          .datetime({ offset: true })
          .refine((value) => Date.parse(value) >= 0)
          .default("1970-01-01T00:00:00.000Z"),
      })
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
      !actor.hasPermission("employee:read")
    )
      throw new CompanyReadForbiddenError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const query = context.req.valid("query")
    const events = await new CompanyPersonnelEventRepository({ env: { DB: context.env.DB } }).list({
      after: query.after_sequence,
      limit: query.limit,
      recordedSince: Math.ceil(Date.parse(query.recorded_since) / 1000),
    })
    if (events instanceof Error) throw new CompanyReadUnavailableError(events)
    return context.json(
      {
        data: events.map((event) => {
          const effect = event.employmentEffect()
          return {
            sequence: event.props.sequence,
            id: event.props.id,
            employee_id: event.props.employeeId,
            kind: event.props.kind,
            event_on: event.props.eventOn,
            recorded_at: new Date(event.props.recordedAt * 1000).toISOString(),
            fingerprint: event.props.fingerprint,
            corrects_action_id: event.props.correctsActionId,
            corrected_by_action_id: event.props.correctedByActionId,
            summary: event.props.summary,
            employment_effect: effect instanceof Error ? null : effect,
            employment_effect_unresolved: effect instanceof Error,
          }
        }),
        next_sequence: events.at(-1)?.props.sequence ?? query.after_sequence,
      },
      200,
    )
  },
)
