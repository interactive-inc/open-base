import { verifyBearer } from "@/api/http/verify-bearer"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import type { HonoEnv } from "@/bindings"
import { CreateReviewCycle } from "@/contexts/performance-review/application/create-review-cycle"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review-cycle.repository"
import { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import { ReviewWorkflowAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-workflow.adapter"
import { createReviewCycleSchema } from "@/contexts/performance-review/interface/http/review-input.schema"
import {
  reviewContext,
  reviewCommand,
  reviewResult,
  reviewPaginationSchema,
} from "@/contexts/performance-review/interface/http/review-runtime"

const factory = createFactory<HonoEnv>()
// @authorization permission - 評価を読む操作能力と現在の在籍を検査する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("query", reviewPaginationSchema),
  async (c) => {
    const context = reviewContext(c),
      query = c.req.valid("query")
    return c.json(
      await reviewResult(async () => {
        const access = await new ReviewAccessAdapter(context).prepare("performance_review:read")
        const data = await new ReviewCycleRepository(context).list(query.limit, query.offset)
        await context.env.DB.batch(access.guards)
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
// @authorization permission - 評価期間と承認規程の管理権限を検査する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", createReviewCycleSchema),
  async (c) => {
    const context = reviewContext(c),
      input = c.req.valid("json")
    const command = await reviewCommand(c, "create_cycle", input, input.id)
    return c.json(
      await reviewResult(() =>
        new CreateReviewCycle({
          repository: new ReviewCycleRepository(context),
          access: new ReviewAccessAdapter(context),
          workflow: new ReviewWorkflowAdapter(context),
          accountId: context.actor.accountId,
          now: context.now,
        }).run(input, command),
      ),
      201,
    )
  },
)
