import { ReviewInboxAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-inbox.adapter"
import { verifyBearer } from "@/api/http/verify-bearer"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"
import type { HonoEnv } from "@/bindings"
import { CreateReviewSheet } from "@/contexts/performance-review/application/create-review-sheet"
import { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review-cycle.repository"
import { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import { createReviewSheetSchema } from "@/contexts/performance-review/interface/http/review-input.schema"
import {
  reviewContext,
  reviewCommand,
  reviewResult,
  reviewPaginationSchema,
} from "@/contexts/performance-review/interface/http/review-runtime"

const factory = createFactory<HonoEnv>()
// @authorization owner - 通常は本人だけを一覧し、全社の閲覧には別の権限を要求する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    reviewPaginationSchema.extend({
      cycle_id: z.uuid().optional(),
      scope: z.enum(["mine", "all", "inbox"]).default("mine"),
    }),
  ),
  async (c) => {
    const context = reviewContext(c),
      query = c.req.valid("query")
    return c.json(
      await reviewResult(async () => {
        if (query.scope === "inbox")
          return new ReviewInboxAdapter(context).list(query.limit, query.offset, query.cycle_id)
        const access = await new ReviewAccessAdapter(context).prepare(
          query.scope === "all" ? "performance_review:read:all" : "performance_review:read",
        )
        const repository = new ReviewSheetRepository(context)
        const data = await repository.list(
          query.cycle_id,
          query.scope === "all",
          query.limit,
          query.offset,
        )
        await repository.verify(access.guards)
        return {
          data,
          limit: query.limit,
          offset: query.offset,
          next_offset: data.length === query.limit ? query.offset + query.limit : null,
        }
      }),
    )
  },
)
// @authorization owner - 認証済みの本人を所有者として評価シートを作る
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", createReviewSheetSchema),
  async (c) => {
    const context = reviewContext(c),
      input = c.req.valid("json"),
      command = await reviewCommand(c, "create_sheet", input, input.id)
    return c.json(
      await reviewResult(() =>
        new CreateReviewSheet({
          repository: new ReviewSheetRepository(context),
          cycles: new ReviewCycleRepository(context),
          access: new ReviewAccessAdapter(context),
          accountId: context.actor.accountId,
          employeeId: context.actor.employeeId,
          now: context.now,
        }).run(input, command),
      ),
      201,
    )
  },
)
