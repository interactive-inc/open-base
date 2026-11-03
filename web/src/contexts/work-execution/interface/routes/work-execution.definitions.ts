import { zValidator } from "@hono/zod-validator"
import { createFactory } from "hono/factory"
import { HTTPException } from "hono/http-exception"
import type { HonoEnv } from "@/bindings"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import {
  definitionInput,
  definitionQuery,
} from "@/contexts/work-execution/domain/work-execution-input"
import { WorkExecutionConflict } from "@/contexts/work-execution/domain/errors"
import { prepareWorkExecutionAccess } from "@/contexts/work-execution/interface/http/prepare-work-execution-access"
import { WorkExecutionRepository } from "@/contexts/work-execution/infrastructure/repositories/work-execution.repository"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { prepareCompanyAuthoritySnapshotGuard } from "@/contexts/company/interface/operations/prepare-company-authority-snapshot-guard"
import { restoreWorkforceId } from "@/contexts/company/domain/definitions/restore-workforce-id.definition"

const factory = createFactory<HonoEnv>()

// @authorization permission - 業務実行台帳の参照権限を要求する
export const GET = factory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("query", definitionQuery),
  async (c) => {
    const access = await prepareWorkExecutionAccess(c, "work_execution:read")
    const query = c.req.valid("query")
    const data = await new WorkExecutionRepository(access).definitions(query)
    return c.json({
      data,
      next_offset: data.length === query.limit ? query.offset + query.limit : null,
    })
  },
)

// @authorization permission - 人の管理権限と責任者の在籍を検査する
export const POST = factory.createHandlers(
  authenticateSystemAccessToken,
  zValidator("json", definitionInput),
  async (c) => {
    const access = await prepareWorkExecutionAccess(c, "work_execution:manage")
    const input = c.req.valid("json")
    const guard = await prepareCompanyAuthoritySnapshotGuard(
      { database: access.database },
      { accountIds: [], employeeCodes: [] },
    )
    if (guard instanceof Error) throw new HTTPException(503)
    const owner = await openCompanyEmployeeDirectory(c).findById(
      restoreWorkforceId("employee", input.owner_employee_id),
    )
    if (owner instanceof Error) throw new HTTPException(503)
    if (input.status === "active" && owner?.employment?.status !== "ACTIVE")
      throw new HTTPException(422, { message: "active_owner_required" })
    const repository = new WorkExecutionRepository({ ...access, guards: [...access.guards, guard] })
    try {
      return c.json(await repository.saveDefinition(input))
    } catch (error) {
      if (error instanceof WorkExecutionConflict)
        throw new HTTPException(409, { message: error.message })
      throw error
    }
  },
)
