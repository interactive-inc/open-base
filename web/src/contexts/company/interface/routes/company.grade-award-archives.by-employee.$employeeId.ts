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

// @authorization permission - 会社へのアクセス資格を持つ本人または属性閲覧権限者が保全済み原記録を参照する
export const GET = factory.createHandlers(
  zValidator("param", z.object({ employeeId: z.string().regex(/^\S{1,200}$/) }), (validation) => {
    if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
  }),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    if (
      !actor.canAccessOrganization(COMPANY_DEFAULT_ORGANIZATION_ID) ||
      (actor.employeeId !== context.req.valid("param").employeeId &&
        !actor.hasPermission("employee:attributes:read"))
    )
      throw new CompanyAccessDeniedError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const archive = await new GradeAwardArchiveReadAdapter({
      env: { DB: context.env.DB },
    }).findByEmployee(context.req.valid("param").employeeId)
    if (archive instanceof Error) throw new CompanyReadUnavailableError(archive)
    if (archive === null)
      throw toHttpException(
        new CompanyNotFoundError("保全記録が見つかりません", "grade_award_archive_not_found"),
      )
    return context.json(archive)
  },
)
