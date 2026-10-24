import { CompanyNotFoundError } from "@/contexts/company/domain/errors"
import { GradeAwardArchiveReadAdapter } from "@/contexts/company/infrastructure/adapters/definitions/grade-award-archive-read.adapter"
import {
  CompanyAuthenticationRequiredError,
  CompanyAccessDeniedError,
  CompanyDatabaseUnavailableError,
  CompanyReadUnavailableError,
  CompanyQueryInvalidError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"
const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service - Company管理者が保全済みの原記録と保全主体を参照する
export const GET = factory.createHandlers(
  zValidator("param", z.object({ commandId: z.string().regex(/^\S{1,200}$/) }), (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      !actor.hasCapability("company:admin")
    )
      throw new CompanyAccessDeniedError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const archive = await new GradeAwardArchiveReadAdapter({ env: { DB: context.env.DB } }).find(
      context.req.valid("param").commandId,
    )
    if (archive instanceof Error) throw new CompanyReadUnavailableError(archive)
    if (archive === null)
      throw toHttpException(
        new CompanyNotFoundError("保全記録が見つかりません", "grade_award_archive_not_found"),
      )
    return context.json(archive)
  },
)
