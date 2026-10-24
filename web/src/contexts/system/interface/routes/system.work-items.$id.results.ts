import { SubmitSystemWorkResult } from "@system/application/work/submit-system-work-result"
import { submitSystemWorkResultSchema } from "@system/domain/schemas/work/system-work-item.schema"
import { prepareSystemWorkContext } from "@system/interface/work/prepare-system-work-context"
import { systemWorkCommandResponseSchema } from "@system/interface/http/work-item-response-schemas"
import { SystemWorkItemHttpError } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - 担当者が確認対象の成果を提出する。
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: z.uuid() })),
  zValidator("json", submitSystemWorkResultSchema.omit({ kind: true, id: true })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const prepared = await prepareSystemWorkContext(context, {
      permission: "system:work:perform",
      requiresStepUp: false,
    })
    if (prepared instanceof Error) throw new SystemWorkItemHttpError(prepared)
    const saved = await new SubmitSystemWorkResult(prepared).execute({
      ...context.req.valid("json"),
      kind: "submit",
      id: context.req.valid("param").id,
    })
    if (saved instanceof Error) throw new SystemWorkItemHttpError(saved)
    return context.json(
      systemWorkCommandResponseSchema.parse({
        workItem: saved.workItem.snapshot,
        replayed: saved.replayed,
      }),
      saved.replayed ? 200 : 201,
    )
  },
)
