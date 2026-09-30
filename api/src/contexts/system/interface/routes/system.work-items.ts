import { z } from "zod"
import { CreateSystemWorkItem } from "@system/application/work/create-system-work-item"
import { createSystemWorkItemSchema } from "@system/domain/schemas/work/system-work-item.schema"
import { prepareSystemWorkContext } from "@system/interface/work/prepare-system-work-context"
import {
  systemWorkCommandResponseSchema,
  systemWorkListResponseSchema,
} from "@system/interface/http/work-item-response-schemas"
import { SystemWorkItemHttpError } from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { zValidator } from "@hono/zod-validator"

// @authorization service - 作業の依頼と責任者を記録する。
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("json", createSystemWorkItemSchema.omit({ kind: true })),
  async (context) => {
    context.header("Cache-Control", "no-store")
    const prepared = await prepareSystemWorkContext(context, {
      permission: "system:work:create",
      requiresStepUp: false,
    })
    if (prepared instanceof Error) throw new SystemWorkItemHttpError(prepared)
    const saved = await new CreateSystemWorkItem(prepared).execute({
      ...context.req.valid("json"),
      kind: "create",
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

// @authorization service - 現在の参加者または管理者に作業一覧を限定する
export const GET = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  zValidator(
    "query",
    z
      .object({
        after: z.uuid().optional(),
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
    const query = context.req.valid("query")
    const workItems = await prepared.repository.list({
      after: query.after ?? null,
      limit: query.limit + 1,
    })
    if (workItems instanceof Error) throw new SystemWorkItemHttpError(workItems)
    const page = workItems.slice(0, query.limit)
    return context.json(
      systemWorkListResponseSchema.parse({
        workItems: page.map((item) => item.snapshot),
        nextCursor: workItems.length > query.limit ? (page.at(-1)?.snapshot.id ?? null) : null,
      }),
      200,
    )
  },
)
