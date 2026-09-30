import { z } from "zod"
import { zValidator } from "@hono/zod-validator"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { prepareSystemWorkContext } from "@system/interface/work/prepare-system-work-context"
import { SystemWorkItemError } from "@system/domain/errors"
import { SystemWorkItemHttpError } from "@system/interface/errors"
import { systemWorkHistoryResponseSchema } from "@system/interface/http/work-item-response-schemas"

// @authorization service - 現在の参加者または管理者に変更不能な作業履歴を開示する
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.object({ id: z.uuid() })),
  zValidator(
    "query",
    z
      .object({
        after: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).default(0),
        limit: z.coerce.number().int().min(1).max(50).default(25),
      })
      .strict(),
  ),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const prepared = await prepareSystemWorkContext(context, {
      permission: "system:work:read",
      requiresStepUp: false,
    })
    if (prepared instanceof Error) throw new SystemWorkItemHttpError(prepared)
    const id = context.req.valid("param").id
    const current = await prepared.repository.findCurrent(id)
    if (current instanceof Error) throw new SystemWorkItemHttpError(current)
    if (current === null) throw new SystemWorkItemHttpError(new SystemWorkItemError("not_found"))
    const query = context.req.valid("query")
    const revisions = await prepared.repository.history({
      id,
      after: query.after,
      limit: query.limit + 1,
    })
    if (revisions instanceof Error) throw new SystemWorkItemHttpError(revisions)
    const page = revisions.slice(0, query.limit)
    return context.json(
      systemWorkHistoryResponseSchema.parse({
        revisions: page.map((item) => item.snapshot),
        nextRevision:
          revisions.length > query.limit ? (page.at(-1)?.snapshot.revision ?? null) : null,
      }),
      200,
    )
  },
)
