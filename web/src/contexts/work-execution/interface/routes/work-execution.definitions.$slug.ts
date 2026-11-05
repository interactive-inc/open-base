import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import { z } from "zod"
import type { HonoEnv } from "@/bindings"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { workSlug } from "@/contexts/work-execution/domain/work-execution-input"
import { WorkExecutionConflict } from "@/contexts/work-execution/domain/errors"
import { prepareWorkExecutionAccess } from "@/contexts/work-execution/interface/http/prepare-work-execution-access"
import { WorkExecutionRepository } from "@/contexts/work-execution/infrastructure/repositories/work-execution.repository"

const factory = createFactory<HonoEnv>()

// @authorization permission - 人の管理権限を要求し、実行履歴のない定義だけを消す
export const DELETE = factory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("param", z.strictObject({ slug: workSlug })),
  zValidator(
    "query",
    z.strictObject({
      expected_revision: z.coerce.number().int().positive().max(2147483647),
    }),
  ),
  async (c) => {
    const access = await prepareWorkExecutionAccess(c, "work_execution:manage")
    const { slug } = c.req.valid("param")
    const { expected_revision } = c.req.valid("query")
    try {
      const deleted = await new WorkExecutionRepository(access).deleteDefinition(
        slug,
        expected_revision,
      )
      if (deleted === null) throw new HTTPException(404)
      return c.json(deleted)
    } catch (error) {
      if (error instanceof WorkExecutionConflict)
        throw new HTTPException(409, { message: error.message })
      throw error
    }
  },
)
