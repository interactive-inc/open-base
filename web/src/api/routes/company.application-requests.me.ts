import { resolveSystemAccountIdsForEmployees } from "@/api/http/accounts/resolve-system-account-ids-for-employees"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { InternalError, UnauthorizedError } from "@/lib/http/errors"
import { zAppApplicationMineList } from "@/api/http/company/response-schemas"
import { systemProposalQuery } from "@/api/http/application-requests/lib/system-application-operation"
import {
  parseSystemApplicationBody,
  toApplicationCurrentStep,
  toApplicationStatus,
} from "@/api/http/application-requests/lib/system-application-view"

// @authorization owner - 本人のリソースに限定する
export const GET = factory.createHandlers(verifyBearer, async (c) => {
  const session = c.var.session
  if (session === null) throw new UnauthorizedError()
  const limit = toBoundedInt({
    raw: c.req.query("limit"),
    fallback: DEFAULT_LIST_LIMIT,
    min: 1,
    max: MAX_LIST_LIMIT,
  })
  const offset = toBoundedInt({
    raw: c.req.query("offset"),
    fallback: 0,
    min: 0,
    max: MAX_LIST_OFFSET,
  })
  const accountIds = await resolveSystemAccountIdsForEmployees(c, [session.employeeId])
  if (accountIds instanceof Error) {
    throw new InternalError("failed to resolve application owner")
  }
  const result = await systemProposalQuery(c).list({
    creatorAccountIds: accountIds,
    actorAccountId: null,
    statuses: null,
    procedureKey: null,
    createdFrom: null,
    createdTo: null,
    includeCancelled: false,
    sort: "created_at_desc",
    limit,
    offset,
    at: new Date(c.env.NOW ?? Date.now()),
  })
  if (result instanceof Error) throw new InternalError("failed to list applications")
  const data = result.proposals.map((proposal) => {
    const payload = parseSystemApplicationBody(proposal)
    if (payload instanceof Error) throw new InternalError("invalid application payload")
    return {
      id: proposal.number,
      template_id: proposal.procedureNumber,
      status: toApplicationStatus(proposal.status),
      current_step: toApplicationCurrentStep(proposal),
      payload: payload.value,
      created_at: proposal.createdAt.toISOString(),
    }
  })

  return c.json(zAppApplicationMineList.parse({ data, total: result.total }), 200)
})
