import { decideSystemApplication } from "@/api/http/application-requests/lib/system-application-operation"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { zValidator } from "@hono/zod-validator"
import { ApplicationError } from "@/lib/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { UnauthorizedError } from "@/lib/http/errors"
import { zAppApplicationDecision } from "@/api/http/company/response-schemas"
import { z } from "zod"

// @authorization service - session を application service に渡して判定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      decision_target: z
        .object({
          proposal_version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
          proposal_digest: z.string().regex(/^[a-f0-9]{64}$/),
          task_key: z.string().min(1).max(100),
          task_round: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        })
        .strict(),
      comment: z
        .string({ error: "却下にはコメントが必須です" })
        .min(1, "却下にはコメントが必須です")
        .max(3_000),
    }),
  ),
  async (c) => {
    const applicationId = validateIntParam(c.req.param("id"), "application")

    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const updated = await decideSystemApplication(c, {
      number: applicationId,
      actorEmployeeId: session.employeeId,
      action: "reject",
      decisionTarget: {
        proposalVersion: body.decision_target.proposal_version,
        proposalDigest: body.decision_target.proposal_digest,
        taskKey: body.decision_target.task_key,
        taskRound: body.decision_target.task_round,
      },
      comment: body.comment,
      decidedAt: new Date(c.env.NOW ?? Date.now()),
    })

    if (updated instanceof ApplicationError) {
      throw toHttpException(updated)
    }

    const responseBody = zAppApplicationDecision.parse({ status: updated.status })

    return c.json(responseBody, 200)
  },
)
