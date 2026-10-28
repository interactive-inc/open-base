import type { Context } from "hono"
import type { HonoEnv } from "@/bindings"
import type {
  ReviewContext,
  ReviewCommand,
} from "@/contexts/performance-review/configuration/review-context"
import { ReviewError } from "@/contexts/performance-review/domain/errors"
import { HTTPException } from "hono/http-exception"
import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { ProposalDigestValue } from "@system/domain/values/workflow/proposal-digest.value"
import { z } from "zod"

export function reviewContext(c: Context<HonoEnv>): ReviewContext {
  c.header("Cache-Control", "no-store")
  const session = c.var.session,
    authentication = c.var.bearerReadAuthentication
  if (session === null || session === undefined || authentication === undefined)
    throw new HTTPException(401, { message: "authentication required" })
  const at = c.var.now()
  return {
    env: c.env,
    var: c.var,
    actor: { accountId: session.accountId, employeeId: session.employeeId, authentication },
    now: () => at,
  }
}
export async function reviewCommand(
  c: Context<HonoEnv>,
  operation: string,
  input: { reason: string },
  id: string | null,
): Promise<ReviewCommand> {
  const key = z.uuid().safeParse(c.req.header("idempotency-key"))
  if (!key.success) throw new HTTPException(400, { message: "a UUID Idempotency-Key is required" })
  const canonical = CanonicalSystemJsonValue.create({ operation, id, input })
  if (canonical instanceof Error) throw new HTTPException(422, { message: "invalid command" })
  const digest = await ProposalDigestValue.create(canonical)
  if (digest instanceof Error) throw new HTTPException(422, { message: "invalid command" })
  return {
    idempotencyKey: key.data,
    digest: digest.toString(),
    reason: input.reason,
    operation,
    detail: input,
  }
}
export async function reviewResult<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof ReviewError) throw new HTTPException(error.status, { message: error.code })
    throw error
  }
}
export const reviewIdSchema = z.strictObject({ id: z.uuid() })
export const reviewPaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
})
