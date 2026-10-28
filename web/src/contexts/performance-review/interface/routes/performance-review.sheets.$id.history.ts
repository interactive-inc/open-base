import { verifyBearer } from "@/api/http/verify-bearer"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { HTTPException } from "hono/http-exception"
import type { HonoEnv } from "@/bindings"
import { ReviewSheetRepository } from "@/contexts/performance-review/infrastructure/repositories/review-sheet.repository"
import { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import {
  reviewContext,
  reviewResult,
  reviewIdSchema,
  reviewPaginationSchema,
} from "@/contexts/performance-review/interface/http/review-runtime"

const factory = createFactory<HonoEnv>()
// @authorization service - 評価を現在閲覧できる主体だけに変更不能な履歴を開示する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("param", reviewIdSchema),
  zValidator("query", reviewPaginationSchema),
  async (c) => {
    const context = reviewContext(c),
      repository = new ReviewSheetRepository(context),
      { id } = c.req.valid("param"),
      query = c.req.valid("query")
    return c.json(
      await reviewResult(async () => {
        const sheet = await repository.find(id)
        if (sheet === null) throw new HTTPException(404, { message: "sheet_not_found" })
        const access = await new ReviewAccessAdapter(context).read(sheet)
        const data = await repository.history(id, query.limit, query.offset)
        await repository.verify([...access.guards, repository.guard(id, sheet.data.revision)])
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
