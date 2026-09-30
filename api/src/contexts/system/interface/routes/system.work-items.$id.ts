import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { prepareSystemWorkContext } from "@system/interface/work/prepare-system-work-context"
import { SystemWorkItemError } from "@system/domain/errors"
import { SystemWorkItemHttpError } from "@system/interface/errors"
import { systemWorkItemResponseSchema } from "@system/interface/http/work-item-response-schemas"

// @authorization service - 現在の参加者または管理者に作業の最新版を開示する
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: z.uuid() })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const prepared = await prepareSystemWorkContext(context, {
      permission: "system:work:read",
      requiresStepUp: false,
    })
    if (prepared instanceof Error) throw new SystemWorkItemHttpError(prepared)
    const workItem = await prepared.repository.findCurrent(context.req.valid("param").id)
    if (workItem instanceof Error) throw new SystemWorkItemHttpError(workItem)
    if (workItem === null) throw new SystemWorkItemHttpError(new SystemWorkItemError("not_found"))
    return context.json(systemWorkItemResponseSchema.parse({ workItem: workItem.snapshot }), 200)
  },
)
