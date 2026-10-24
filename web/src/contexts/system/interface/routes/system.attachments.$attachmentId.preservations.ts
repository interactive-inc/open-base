import { SystemAttachmentPreservationHttpError } from "@system/interface/errors"
import { CreateAttachmentPreservation } from "@system/application/attachments/create-attachment-preservation"
import { attachmentPreservationCommandSchema } from "@system/domain/schemas/attachments/attachment-preservation.schema"
import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"
import { prepareAttachmentPreservationAuthorization } from "@system/interface/authorization/prepare-attachment-preservation-authorization"
import { toAttachmentPreservationHttpFailure } from "@system/interface/attachments/to-attachment-preservation-http-failure"
import {
  attachmentPreservationListResponseSchema,
  attachmentPreservationResponseSchema,
} from "@system/interface/http/attachment-preservation-response-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const parameters = z.strictObject({ attachmentId: z.string().min(1).max(64) })

// @authorization permission system:admin - 人の現在の権限で保全と解除の記録を読む
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", parameters),
  zValidator(
    "query",
    z.strictObject({
      cursor: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  ),
  async (context) => {
    const proof = await prepareAttachmentPreservationAuthorization(context, {
      now: context.var.now(),
      stepUpToken: null,
    })
    if (proof instanceof Error || proof === "forbidden")
      throw new SystemAttachmentPreservationHttpError(toAttachmentPreservationHttpFailure(proof))
    const query = context.req.valid("query")
    const records = await new AttachmentPreservationRepository({
      env: { DB: context.env.DB },
      assertions: proof,
    }).findMany(context.req.valid("param").attachmentId, query.cursor ?? "", query.limit + 1)
    if (records instanceof Error)
      throw new SystemAttachmentPreservationHttpError(toAttachmentPreservationHttpFailure(records))
    const page = records.slice(0, query.limit).map((record) => record.snapshot)
    return context.json(
      attachmentPreservationListResponseSchema.parse({
        preservations: page,
        next_cursor: records.length > query.limit ? (page.at(-1)?.id ?? null) : null,
      }),
      200,
    )
  },
)

// @authorization permission system:admin - 人の再認証と現在の権限を確認し、内容を固定した添付を保全する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator("param", parameters),
  zValidator(
    "json",
    attachmentPreservationCommandSchema.omit({ attachmentId: true, actorAccountId: true }),
  ),
  async (context) => {
    const now = context.var.now()
    const proof = await prepareAttachmentPreservationAuthorization(context, {
      now,
      stepUpToken: context.req.header("x-system-step-up") ?? "",
    })
    if (proof instanceof Error || proof === "forbidden")
      throw new SystemAttachmentPreservationHttpError(toAttachmentPreservationHttpFailure(proof))
    const service = new CreateAttachmentPreservation({
      repository: new AttachmentPreservationRepository({
        env: { DB: context.env.DB },
        assertions: proof,
      }),
    })
    const result = await service.execute(
      {
        ...context.req.valid("json"),
        attachmentId: context.req.valid("param").attachmentId,
        actorAccountId: context.var.userId,
      },
      now,
    )
    if (result instanceof Error || typeof result === "string")
      throw new SystemAttachmentPreservationHttpError(toAttachmentPreservationHttpFailure(result))
    return context.json(
      attachmentPreservationResponseSchema.parse({
        preservation: result.preservation.snapshot,
        replayed: result.kind === "replayed",
      }),
      result.kind === "created" ? 201 : 200,
    )
  },
)
