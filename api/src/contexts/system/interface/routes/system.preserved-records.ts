import { DisclosePreservedRecordIndexPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-index-persistence.adapter"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { preparePreservedRecordReadAuthorization } from "@system/interface/authorization/prepare-preserved-record-read-authorization"
import { DisclosePreservedRecordIndex } from "@system/application/records/disclose-preserved-record-index"
import { preservedRecordSearchSchema } from "@system/domain/schemas/records/preserved-record-search.schema"
import {
  SystemForbiddenError,
  SystemPreservedRecordUnavailableError,
} from "@system/interface/errors"

// @authorization service - 現在の参照・出力権限と個別開示条件を満たす保全記録だけを探す
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "query",
    z.strictObject({
      action: preservedRecordSearchSchema.shape.action,
      purpose: preservedRecordSearchSchema.shape.purpose,
      source_namespace: preservedRecordSearchSchema.shape.sourceNamespace.default(null),
      owner_context: preservedRecordSearchSchema.shape.ownerContext.default(null),
      record_kind: preservedRecordSearchSchema.shape.recordKind.default(null),
      source_record_id: preservedRecordSearchSchema.shape.sourceRecordId.default(null),
      cursor: preservedRecordSearchSchema.shape.after.default(null),
      limit: z.coerce.number().int().min(1).max(50).default(25),
    }),
  ),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const authentication = context.var.bearerReadAuthentication
    if (authentication === undefined) throw new SystemForbiddenError()
    const query = context.req.valid("query")
    const authorization = await preparePreservedRecordReadAuthorization(context, {
      authentication,
      action: query.action,
      at: context.var.now(),
    })
    if (authorization instanceof Error) throw new SystemPreservedRecordUnavailableError()
    if (authorization === null) throw new SystemForbiddenError()
    const page = await new DisclosePreservedRecordIndex({
      accountId: authentication.accountId,
      now: () => context.var.now(),
      persistence: new DisclosePreservedRecordIndexPersistenceAdapter({
        env: context.env,
        authorizationAssertions: (at) => authorization.assertions(at),
      }),
    }).execute({
      action: query.action,
      purpose: query.purpose,
      sourceNamespace: query.source_namespace,
      ownerContext: query.owner_context,
      recordKind: query.record_kind,
      sourceRecordId: query.source_record_id,
      after: query.cursor,
      limit: query.limit,
    })
    if (page instanceof Error) throw new SystemPreservedRecordUnavailableError()
    return context.json(page, 200)
  },
)
