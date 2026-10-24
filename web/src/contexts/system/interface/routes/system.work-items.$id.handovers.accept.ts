import { AcceptSystemWorkHandover } from "@system/application/work/accept-system-work-handover"
import { acceptSystemWorkHandoverSchema } from "@system/domain/schemas/work/system-work-item.schema"
import { prepareSystemWorkContext } from "@system/interface/work/prepare-system-work-context"
import { systemWorkCommandResponseSchema } from "@system/interface/http/work-item-response-schemas"
import { SystemWorkItemHttpError } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - 引き継ぎ先が作業の責任を受領する。
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: z.uuid() })),
  requireSystemStepUp,
  zValidator("header", z.object({ "x-system-step-up": z.string().regex(/^[0-9a-f]{64}$/) })),
  zValidator("json", acceptSystemWorkHandoverSchema.omit({ kind: true, id: true })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const prepared = await prepareSystemWorkContext(context, {
      permission: "system:work:manage",
      requiresStepUp: true,
    })
    if (prepared instanceof Error) throw new SystemWorkItemHttpError(prepared)
    const saved = await new AcceptSystemWorkHandover(prepared).execute({
      ...context.req.valid("json"),
      kind: "accept_handover",
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
