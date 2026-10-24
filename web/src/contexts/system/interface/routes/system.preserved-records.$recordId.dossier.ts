import { systemFactory } from "@system/interface/request-environment/system-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import {
  SystemForbiddenError,
  SystemPreservedRecordUnavailableError,
} from "@system/interface/errors"
import { PreservedRecordDisclosureDeniedError } from "@system/domain/errors"
import { DisclosePreservedRecordDossier } from "@system/application/records/disclose-preserved-record-dossier"
import { DisclosePreservedRecordDossierPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-dossier-persistence.adapter"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - 原文・承認・保全・監査それぞれの開示資格と最終監査保存を要求する
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ recordId: z.uuid() })),
  zValidator("query", z.strictObject({ purpose: z.string().trim().min(1).max(255) })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const authentication = context.var.bearerReadAuthentication
    if (authentication === undefined) throw new SystemForbiddenError()
    const purpose = context.req.valid("query").purpose
    const dossier = await new DisclosePreservedRecordDossier({
      env: context.env,
      var: context.var,
      accountId: authentication.accountId,
      purpose,
      now: () => context.var.now(),
      persistence: new DisclosePreservedRecordDossierPersistenceAdapter({
        env: context.env,
        authentication,
        purpose,
      }),
    }).execute(context.req.valid("param").recordId)
    if (dossier instanceof PreservedRecordDisclosureDeniedError) throw new SystemForbiddenError()
    if (dossier instanceof Error) throw new SystemPreservedRecordUnavailableError()
    context.header("Content-Type", "application/vnd.record-preservation-dossier+json")
    context.header("Content-Disposition", 'attachment; filename="preserved-record-dossier.json"')
    context.header("X-Content-Type-Options", "nosniff")
    return context.body(JSON.stringify(dossier))
  },
)
