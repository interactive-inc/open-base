import { ApproveSystemWorkResult } from "@system/application/work/approve-system-work-result"
import { approveSystemWorkResultSchema } from "@system/domain/schemas/work/system-work-item.schema"
import { prepareSystemWorkContext } from "@system/interface/work/prepare-system-work-context"
import { systemWorkCommandResponseSchema } from "@system/interface/http/work-item-response-schemas"
import { SystemWorkItemHttpError } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization service - 責任者が正確な成果を確認し作業を完了する。
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: z.uuid() })),
  requireSystemStepUp,
  zValidator("header", z.object({ "x-system-step-up": z.string().regex(/^[0-9a-f]{64}$/) })),
  zValidator("json", approveSystemWorkResultSchema.omit({ kind: true, id: true })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const prepared = await prepareSystemWorkContext(context, {
      permission: "system:work:review",
      requiresStepUp: true,
    })
    if (prepared instanceof Error) throw new SystemWorkItemHttpError(prepared)
    const saved = await new ApproveSystemWorkResult(prepared).execute({
      ...context.req.valid("json"),
      kind: "approve",
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
