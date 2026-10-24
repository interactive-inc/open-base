import { SystemAttachmentPreservationHttpError } from "@system/interface/errors"
import { ReleaseAttachmentPreservation } from "@system/application/attachments/release-attachment-preservation"
import { AttachmentPreservationRepository } from "@system/infrastructure/repositories/attachments/attachment-preservation.repository"
import { prepareAttachmentPreservationAuthorization } from "@system/interface/authorization/prepare-attachment-preservation-authorization"
import { toAttachmentPreservationHttpFailure } from "@system/interface/attachments/to-attachment-preservation-http-failure"
import { attachmentPreservationResponseSchema } from "@system/interface/http/attachment-preservation-response-schemas"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission system:admin - 指定した削除停止だけを再認証した人が解除する
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  zValidator(
    "param",
    z.strictObject({ attachmentId: z.string().min(1).max(64), preservationId: z.uuid() }),
  ),
  zValidator(
    "json",
    z.strictObject({
      operationId: z.uuid(),
      expectedRevision: z.literal(1),
      reason: z.string().trim().min(1).max(1000),
    }),
  ),
  async (context) => {
    const now = context.var.now()
    const proof = await prepareAttachmentPreservationAuthorization(context, {
      now,
      stepUpToken: context.req.header("x-system-step-up") ?? "",
    })
    if (proof instanceof Error || proof === "forbidden")
      throw new SystemAttachmentPreservationHttpError(toAttachmentPreservationHttpFailure(proof))
    const service = new ReleaseAttachmentPreservation({
      repository: new AttachmentPreservationRepository({
        env: { DB: context.env.DB },
        assertions: proof,
      }),
    })
    const parameters = context.req.valid("param")
    const result = await service.execute(
      {
        ...context.req.valid("json"),
        id: parameters.preservationId,
        attachmentId: parameters.attachmentId,
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
      200,
    )
  },
)
