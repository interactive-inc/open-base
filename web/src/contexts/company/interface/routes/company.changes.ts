import { CompanyChangeFeedRepository } from "@/contexts/company/infrastructure/repositories/core/company-change-feed.repository"
import { CompanySnapshotRevisionError } from "@/contexts/company/domain/errors"
import { CompanyChangeCursorValue } from "@/contexts/company/domain/values/company-change-cursor.value"
import { companyResourceTypes } from "@/contexts/company/domain/catalogs/company-resource-type.catalog"
import { canReadCompanyResource } from "@/contexts/company/interface/operations/company-resource-read-permission"
import type { CompanyHttpEnvironment } from "@/contexts/company/interface/request-environment/company-request-environment"
import {
  CompanyAuthenticationRequiredError,
  CompanyAccessDeniedError,
  CompanyDatabaseUnavailableError,
  CompanyHeadersInvalidError,
  CompanyQueryInvalidError,
  CompanyReadUnavailableError,
} from "@/contexts/company/interface/errors"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const factory = createFactory<CompanyHttpEnvironment>()

// @authorization service - 資源ごとの閲覧資格で変更理由・証跡を絞って取得する
export const GET = factory.createHandlers(
  zValidator(
    "header",
    z.object({ "x-company-organization-id": z.string().regex(/^\S{1,255}$/) }),
    (validation) => {
      if (!validation.success) throw new CompanyHeadersInvalidError(validation.error)
    },
  ),
  zValidator(
    "query",
    z.strictObject({
      cursor: z.string().max(4096).optional(),
      through_revision: z.coerce
        .number()
        .int()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER)
        .optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      resource_type: z.enum(companyResourceTypes).optional(),
    }),
    (validation) => {
      if (!validation.success) throw new CompanyQueryInvalidError(validation.error)
    },
  ),
  async (context) => {
    const actor = context.var.companyActor
    if (actor === undefined) throw new CompanyAuthenticationRequiredError()
    const organizationId = context.req.valid("header")["x-company-organization-id"]
    if (!actor.canAccessOrganization(organizationId) || !actor.hasCapability("company:read"))
      throw new CompanyAccessDeniedError()
    if (context.env.DB === undefined) throw new CompanyDatabaseUnavailableError()
    const query = context.req.valid("query")
    const visibleTypes = companyResourceTypes.filter(
      (type) =>
        (query.resource_type === undefined || type === query.resource_type) &&
        canReadCompanyResource(actor, type),
    )
    if (visibleTypes.length === 0) throw new CompanyAccessDeniedError()
    const cursor = CompanyChangeCursorValue.restore(query.cursor, organizationId)
    if (cursor instanceof Error) throw new CompanyQueryInvalidError(cursor)
    if (cursor.props.type !== null && !visibleTypes.includes(cursor.props.type))
      throw new CompanyQueryInvalidError(new Error("Cursor resource type is not visible"))
    const page = await new CompanyChangeFeedRepository(context.env.DB).list({
      organizationId,
      visibleTypes,
      afterRevision: cursor.props.revision,
      afterType: cursor.props.type,
      afterId: cursor.props.id,
      afterResourceRevision: cursor.props.resourceRevision,
      throughRevision: query.through_revision ?? null,
      limit: query.limit,
    })
    if (page instanceof CompanySnapshotRevisionError) throw new CompanyQueryInvalidError(page)
    if (page instanceof Error) throw new CompanyReadUnavailableError(page)
    return context.json({
      data: page.changes,
      through_revision: page.throughRevision,
      has_more: page.hasMore,
      next_cursor: JSON.stringify(page.next),
    })
  },
)
