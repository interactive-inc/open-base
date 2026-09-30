import { resolveActiveSystemAccountId } from "@/api/http/accounts/resolve-active-system-account-id"
import { resolveCompanyAccountParticipants } from "@/api/http/accounts/resolve-company-account-participants"
import { factory } from "@/api/http/factory"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { verifyBearer } from "@/api/http/verify-bearer"
import { InternalError, UnauthorizedError } from "@/lib/http/errors"
import { zAppApplicationInboxList } from "@/api/http/company/response-schemas"
import { systemProposalQuery } from "@/api/http/application-requests/lib/system-application-operation"
import {
  toApplicationCurrentStep,
  toApplicationStatus,
} from "@/api/http/application-requests/lib/system-application-view"

// @authorization service - 固定済みSystem Task候補または有効な代理だけに限定する
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
  const actorAccountId = await resolveActiveSystemAccountId(c, session.accountId)
  if (actorAccountId instanceof Error) {
    throw new InternalError("failed to resolve canonical workflow actor")
  }
  const sort = c.req.query("sort") === "created_at_asc" ? "created_at_asc" : "created_at_desc"
  const result = await systemProposalQuery(c).list({
    creatorAccountIds: null,
    actorAccountId,
    statuses: ["pending"],
    procedureKey: null,
    createdFrom: null,
    createdTo: null,
    includeCancelled: false,
    sort,
    limit,
    offset,
    at: new Date(c.env.NOW ?? Date.now()),
  })
  if (result instanceof Error) throw new InternalError("failed to list application inbox")
  const participants = await resolveCompanyAccountParticipants(
    c,
    result.proposals.map((proposal) => proposal.createdByAccountId),
  )
  if (participants instanceof Error) {
    throw new InternalError("failed to resolve application owners")
  }
  const names = new Map(
    participants.map((participant) => [participant.accountId, participant.employeeName]),
  )

  return c.json(
    zAppApplicationInboxList.parse({
      data: result.proposals.map((proposal) => ({
        id: proposal.number,
        template_name: proposal.title,
        applicant_name: names.get(proposal.createdByAccountId) ?? "",
        current_step: toApplicationCurrentStep(proposal),
        status: toApplicationStatus(proposal.status),
        created_at: proposal.createdAt.toISOString(),
      })),
      total: result.total,
    }),
    200,
  )
})
