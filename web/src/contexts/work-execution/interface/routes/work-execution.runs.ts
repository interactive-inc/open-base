import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import type { HonoEnv } from "@/bindings"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import {
  executionInput,
  executionQuery,
} from "@/contexts/work-execution/domain/work-execution-input"
import { WorkExecutionConflict } from "@/contexts/work-execution/domain/errors"
import { prepareWorkExecutionAccess } from "@/contexts/work-execution/interface/http/prepare-work-execution-access"
import { WorkExecutionRepository } from "@/contexts/work-execution/infrastructure/repositories/work-execution.repository"

const factory = createFactory<HonoEnv>()

// @authorization permission - 業務実行台帳の参照権限を要求する
export const GET = factory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("query", executionQuery),
  async (c) => {
    const access = await prepareWorkExecutionAccess(c, "work_execution:read")
    const query = c.req.valid("query")
    const data = await new WorkExecutionRepository(access).executions(query)
    return c.json({
      data,
      next_offset: data.length === query.limit ? query.offset + query.limit : null,
    })
  },
)

// @authorization permission - 機械資格情報と担当agentを照合する
export const POST = factory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("json", executionInput),
  async (c) => {
    const access = await prepareWorkExecutionAccess(c, "work_execution:record")
    const input = c.req.valid("json")
    const repository = new WorkExecutionRepository(access)
    try {
      return c.json(await repository.record(input))
    } catch (error) {
      if (error instanceof WorkExecutionConflict)
        throw new HTTPException(409, { message: error.message })
      throw error
    }
  },
)
