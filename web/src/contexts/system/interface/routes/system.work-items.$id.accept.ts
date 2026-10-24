import { AcceptSystemWorkItem } from "@system/application/work/accept-system-work-item"
import { acceptSystemWorkItemSchema } from "@system/domain/schemas/work/system-work-item.schema"
import { prepareSystemWorkContext } from "@system/interface/work/prepare-system-work-context"
import { systemWorkCommandResponseSchema } from "@system/interface/http/work-item-response-schemas"
import { SystemWorkItemHttpError } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - 担当者が作業を受領する。
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: z.uuid() })),
  zValidator("json", acceptSystemWorkItemSchema.omit({ kind: true, id: true })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const prepared = await prepareSystemWorkContext(context, {
      permission: "system:work:perform",
      requiresStepUp: false,
    })
    if (prepared instanceof Error) throw new SystemWorkItemHttpError(prepared)
    const saved = await new AcceptSystemWorkItem(prepared).execute({
      ...context.req.valid("json"),
      kind: "accept",
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
