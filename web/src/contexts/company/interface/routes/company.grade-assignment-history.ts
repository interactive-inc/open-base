import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { CompanySnapshotRevisionError } from "@/contexts/company/domain/errors"
import { GradeAssignmentHistoryRepository } from "@/contexts/company/infrastructure/repositories/definitions/grade-assignment-history.repository"
import {
  CompanyAccessDeniedError,
  CompanyAuthenticationRequiredError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization permission - 会社へのアクセス資格を持つ本人または属性閲覧権限者が等級の全改訂を参照する
export const GET = factory.createHandlers(
  zValidator(
    "header",
    z.object({
      "x-company-organization-id": z.string().regex(/^\S{1,255}$/),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "query",
    z.object({
      employee_id: z.string().regex(/^\S{1,128}$/),
      organization_revision: z
        .string()
        .regex(/^(0|[1-9]\d*)$/)
        .transform(Number)
        .pipe(z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)),
      offset: z
        .string()
        .regex(/^(0|[1-9]\d*)$/)
        .transform(Number)
        .pipe(
          z
            .number()
            .int()
            .nonnegative()
            .max(Number.MAX_SAFE_INTEGER - 101),
        )
        .optional(),
      limit: z
        .string()
        .regex(/^[1-9]\d*$/)
        .transform(Number)
        .pipe(z.number().int().min(1).max(100))
        .optional(),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    const organizationId = context.req.valid("header")["x-company-organization-id"]
    const query = context.req.valid("query")
    if (
      !actor.canAccessOrganization(organizationId) ||
      (actor.employeeId !== query.employee_id && !actor.hasPermission("employee:attributes:read"))
    )
      throw new CompanyAccessDeniedError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const history = await new GradeAssignmentHistoryRepository(context.env.DB).find({
      organizationId,
      employeeId: query.employee_id,
      organizationRevision: query.organization_revision,
      offset: query.offset ?? 0,
      limit: query.limit ?? 100,
    })
    if (history instanceof CompanySnapshotRevisionError) throw new CompanyQueryInvalidError(history)
    if (history instanceof Error) throw new CompanyReadUnavailableError(history)
    context.header("etag", `"${history.organizationRevision}"`)
    return context.json(history)
  },
)
