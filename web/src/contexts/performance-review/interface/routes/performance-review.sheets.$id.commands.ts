import { verifyBearer } from "@/api/http/verify-bearer"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import type { HonoEnv } from "@/bindings"
import { ChangeReviewSheet } from "@/contexts/performance-review/application/change-review-sheet"
import { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import { ReviewWorkflowAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-workflow.adapter"
import { reviewCommandSchema } from "@/contexts/performance-review/domain/values/review-command.value"
import {
  reviewContext,
  reviewCommand,
  reviewResult,
  reviewIdSchema,
} from "@/contexts/performance-review/interface/http/review-runtime"

const factory = createFactory<HonoEnv>()
// @authorization service - 本人の変更と会社上の判断資格をapplicationで合成する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("param", reviewIdSchema),
  zValidator("json", reviewCommandSchema),
  async (c) => {
    const context = reviewContext(c),
      input = c.req.valid("json"),
      { id } = c.req.valid("param"),
      command = await reviewCommand(c, input.operation, input, id)
    return c.json(
      await reviewResult(() =>
        new ChangeReviewSheet({
          repository: new ReviewSheetRepository(context),
          access: new ReviewAccessAdapter(context),
          workflow: new ReviewWorkflowAdapter(context),
          accountId: context.actor.accountId,
          now: context.now,
        }).run(id, input, command),
      ),
    )
  },
)
