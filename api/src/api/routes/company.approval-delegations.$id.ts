import { InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { resolveActiveSystemAccountId } from "@/api/http/accounts/resolve-active-system-account-id"
import { validateIntParam } from "@/lib/http/validate-int-param"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { createSystemProcedureDelegationRepository } from "@/api/http/approval-delegations/create-system-procedure-delegation-repository"

// @authorization owner - 委任元本人だけが取消できる
export const DELETE = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const accountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (accountId instanceof Error) throw new InternalError("failed to resolve canonical actor")
  const result = await createSystemProcedureDelegationRepository(c).revoke({
    number: validateIntParam(c.req.param("id"), "delegation"),
    delegatorAccountId: accountId,
    revokedAt: new Date(c.env.NOW ?? Date.now()),
  })
  if (result === "not_found") throw new NotFoundError("delegation not found")
  if (result instanceof Error) throw new InternalError("failed to revoke delegation")

  return c.body(null, 204)
})
