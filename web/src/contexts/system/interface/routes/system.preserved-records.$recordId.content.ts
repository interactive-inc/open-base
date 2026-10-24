import { AttachmentRecordContentValue } from "@system/domain/values/records/attachment-record-content.value"
import { ATTACHMENT_RECORD_FORMAT_ID } from "@system/domain/catalogs/records/attachment-record-format.catalog"
import { DisclosePreservedRecordPersistenceAdapter } from "@system/infrastructure/adapters/records/disclose-preserved-record-persistence.adapter"
import { toBase64 } from "@system/application/attachments/lib/to-base64"
import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { preparePreservedRecordReadAuthorization } from "@system/interface/authorization/prepare-preserved-record-read-authorization"
import { DisclosePreservedRecordContent } from "@system/application/records/disclose-preserved-record-content"
import { PreservedRecordDisclosureDeniedError } from "@system/domain/errors"
import {
  SystemForbiddenError,
  SystemPreservedRecordNotAttachmentError,
  SystemPreservedRecordUnavailableError,
} from "@system/interface/errors"

// @authorization service - 現在の操作権限・個別開示設定・監査保存を満たす保全原文だけを返す
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ recordId: z.uuid() })),
  zValidator(
    "query",
    z
      .strictObject({
        action: z.enum(["read", "export"]),
        purpose: z.string().min(1).max(255),
        format: z.enum(["original", "package", "attachment"]).default("original"),
      })
      .refine(
        (value) => value.format !== "package" || value.action === "export",
        "package requires export",
      ),
  ),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const authentication = context.var.bearerReadAuthentication
    if (authentication === undefined) throw new SystemForbiddenError()
    const query = context.req.valid("query")
    const proof = await preparePreservedRecordReadAuthorization(context, {
      authentication,
      action: query.action,
      at: context.var.now(),
    })
    if (proof instanceof Error) throw new SystemPreservedRecordUnavailableError()
    if (proof === null) throw new SystemForbiddenError()
    const assertions = proof.assertions(context.var.now())
    if (assertions instanceof Error) throw new SystemPreservedRecordUnavailableError()
    const first = assertions.at(0)
    if (first === undefined) throw new SystemPreservedRecordUnavailableError()
    const persistence = new DisclosePreservedRecordPersistenceAdapter({
      env: context.env,
      assertions: [first, ...assertions.slice(1)],
    })
    const content = await new DisclosePreservedRecordContent({
      env: context.env,
      var: context.var,
      accountId: authentication.accountId,
      now: () => context.var.now(),
      persistence,
    }).execute({
      recordId: context.req.valid("param").recordId,
      action: query.action,
      purpose: query.purpose,
    })
    if (content instanceof PreservedRecordDisclosureDeniedError) throw new SystemForbiddenError()
    if (content instanceof Error) throw new SystemPreservedRecordUnavailableError()
    if (query.format === "attachment") {
      if (
        content.source.formatId !== ATTACHMENT_RECORD_FORMAT_ID ||
        content.source.formatVersion !== 1
      )
        throw new SystemPreservedRecordNotAttachmentError()
      const attachment = await AttachmentRecordContentValue.restore(content.content)
      if (attachment instanceof Error || attachment.metadata.id !== content.source.recordId)
        throw new SystemPreservedRecordUnavailableError()
      const checked = await persistence.revalidate(content.assertions)
      if (checked instanceof Error) throw new SystemPreservedRecordUnavailableError()
      const fileName = encodeURIComponent(
        new TextDecoder().decode(new TextEncoder().encode(attachment.metadata.fileName)),
      ).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
      const contentType = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(
        attachment.metadata.contentType,
      )
        ? attachment.metadata.contentType
        : "application/octet-stream"
      context.header("Content-Type", contentType)
      context.header("Content-Disposition", `attachment; filename*=UTF-8''${fileName}`)
      context.header("X-Content-Type-Options", "nosniff")
      return context.body(attachment.contentBytes().buffer)
    }
    if (query.format === "package") {
      context.header("Content-Type", "application/vnd.record-preservation+json")
      context.header("Content-Disposition", 'attachment; filename="preserved-record.json"')
      context.header("X-Content-Type-Options", "nosniff")
      return context.body(
        JSON.stringify({
          version: 1,
          source: content.source,
          contentBase64: toBase64(new Uint8Array(content.content)),
        }),
      )
    }
    context.header("Content-Type", "application/octet-stream")
    context.header("Content-Disposition", 'attachment; filename="preserved-record.bin"')
    context.header("X-Content-Type-Options", "nosniff")
    return context.body(new Uint8Array(content.content).buffer)
  },
)
