import { reviseSystemApplication } from "@/api/http/application-requests/lib/system-application-operation"
import {
  parseSystemApplicationBody,
  toApplicationCurrentStep,
  toApplicationStatus,
} from "@/api/http/application-requests/lib/system-application-view"
import { InternalError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { jsonPayloadSchema } from "@/lib/http/json-payload-schema"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { ApplicationError } from "@/lib/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization owner - 本人のリソースに限定する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", z.object({ payload: jsonPayloadSchema(10_000) })),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()

    const result = await reviseSystemApplication(c, {
      number: validateIntParam(c.req.param("id"), "application"),
      applicantId: session.employeeId,
      payload: c.req.valid("json").payload,
      revisedAt: new Date(c.env.NOW ?? Date.now()),
      mode: "resubmit",
    })

    if (result instanceof ApplicationError) throw toHttpException(result)

    const payload = parseSystemApplicationBody(result.proposal)
    if (payload instanceof Error) throw new InternalError("invalid application payload")
    return c.json(
      {
        id: result.proposal.number,
        status: toApplicationStatus(result.proposal.status),
        current_step: toApplicationCurrentStep(result.proposal),
        payload: payload.value,
      },
      200,
    )
  },
)
