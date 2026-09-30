import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { CompanyNotFoundError } from "@/contexts/company/domain/errors"
import { DefinitionResourceAdoptionReadAdapter } from "@/contexts/company/infrastructure/adapters/definitions/definition-resource-adoption-read.adapter"
import {
  CompanyAuthenticationRequiredError,
  CompanyAccessDeniedError,
  CompanyDatabaseUnavailableError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { toHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import { COMPANY_DEFAULT_ORGANIZATION_ID } from "@/contexts/company/domain/definitions/company-organization-identity.definition"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service - Company管理者が旧台帳撤去後も定義の移行証跡を参照する
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
    const record = await new DefinitionResourceAdoptionReadAdapter({
      env: { DB: context.env.DB },
    }).find(context.req.valid("param").commandId)
    if (record instanceof Error) throw new CompanyReadUnavailableError(record)
    if (record === null)
      throw toHttpException(
        new CompanyNotFoundError("定義の移行証跡が見つかりません", "definition_adoption_not_found"),
      )
    return context.json(record)
  },
)
