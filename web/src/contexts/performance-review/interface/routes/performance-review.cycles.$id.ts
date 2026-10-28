import { verifyBearer } from "@/api/http/verify-bearer"
import { createFactory } from "hono/factory"
import { zValidator } from "@hono/zod-validator"
import { HTTPException } from "hono/http-exception"
import type { HonoEnv } from "@/bindings"
import { ReviewCycleRepository } from "@/contexts/performance-review/infrastructure/repositories/review-cycle.repository"
import { ReviewAccessAdapter } from "@/contexts/performance-review/infrastructure/adapters/review-access.adapter"
import {
  reviewContext,
  reviewResult,
  reviewIdSchema,
} from "@/contexts/performance-review/interface/http/review-runtime"
import { openSystemProcedures } from "@system/interface/operations/open-system-procedures"
import { procedureKeySchema } from "@system/domain/schemas/workflow/procedure-key.schema"
import { parseCompanyProcedureDecisionPolicy } from "@/contexts/company/domain/policies/parse-company-procedure-decision.policy"

const factory = createFactory<HonoEnv>()
// @authorization permission - 現在の閲覧権限と在籍を確認し、固定した承認規程を開示する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator("param", reviewIdSchema),
  async (c) => {
    const context = reviewContext(c),
      { id } = c.req.valid("param")
    return c.json(
      await reviewResult(async () => {
        const access = await new ReviewAccessAdapter(context).prepare("performance_review:read")
        const cycle = await new ReviewCycleRepository(context).find(id)
        if (cycle === null) throw new HTTPException(404, { message: "cycle_not_found" })
        const repository = openSystemProcedures(context)
        const definitions = await Promise.all(
          [cycle.data.goals_procedure_key, cycle.data.evaluation_procedure_key].map((key) =>
            repository.find(procedureKeySchema.parse(key)),
          ),
        )
        const workflows = definitions.map((definition) => {
          if (definition === null || definition instanceof Error || definition.revision !== 1)
            throw new HTTPException(503, { message: "review_procedure_unavailable" })
          const policy = parseCompanyProcedureDecisionPolicy(
            JSON.parse(definition.decisionPolicyJson),
          )
          if (policy instanceof Error)
            throw new HTTPException(503, { message: "approval_policy_unavailable" })
          return { revision: definition.revision, workflow: policy.workflow }
        })
        await context.env.DB.batch(access.guards)
        return { ...cycle.data, goal_approval: workflows[0], evaluation_approval: workflows[1] }
      }),
    )
  },
)
