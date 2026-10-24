import { resolveCompanyAccountParticipants } from "@/api/http/accounts/resolve-company-account-participants"
import { resolveSystemAccountIdsForEmployees } from "@/api/http/accounts/resolve-system-account-ids-for-employees"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { zValidator } from "@hono/zod-validator"
import { ForbiddenError, InternalError, UnauthorizedError } from "@/lib/http/errors"
import { zAppApplicationAdminList } from "@/api/http/company/response-schemas"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { z } from "zod"
import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { systemProposalQuery } from "@/api/http/application-requests/lib/system-application-operation"
import {
  toApplicationCurrentStep,
  toApplicationStatus,
  toSystemStatuses,
} from "@/api/http/application-requests/lib/system-application-view"
import { parseOptionalDate } from "@/api/http/application-requests/lib/parse-optional-date"

// @authorization permission - application:read:all保持者だけに限定する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      applicant_id: zEmployeeId.optional(),
      template_code: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      sort: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
    if (!session.hasPermission("application:read:all")) throw new ForbiddenError()
    const query = c.req.valid("query")
    const limit = toBoundedInt({
      raw: query.limit,
      fallback: DEFAULT_LIST_LIMIT,
      min: 1,
      max: MAX_LIST_LIMIT,
    })
    const offset = toBoundedInt({
      raw: query.offset,
      fallback: 0,
      min: 0,
      max: MAX_LIST_OFFSET,
    })
    let creatorAccountIds = null
    if (query.applicant_id !== undefined) {
      const resolved = await resolveSystemAccountIdsForEmployees(c, [query.applicant_id])
      if (resolved instanceof Error) {
        throw new InternalError("failed to resolve application owner")
      }
      creatorAccountIds = resolved
    }
    const createdFrom = parseOptionalDate(query.from)
    const createdTo = parseOptionalDate(query.to)
    const result = await systemProposalQuery(c).list({
      creatorAccountIds,
      actorAccountId: null,
      statuses: toSystemStatuses(query.status),
      procedureKey:
        query.template_code === undefined || query.template_code === ""
          ? null
          : query.template_code,
      createdFrom,
      createdTo,
      includeCancelled: false,
      sort: query.sort === "created_at_asc" ? "created_at_asc" : "created_at_desc",
      limit,
      offset,
      at: new Date(c.env.NOW ?? Date.now()),
    })
    if (result instanceof Error) throw new InternalError("failed to list applications")
    const participants = await resolveCompanyAccountParticipants(
      c,
      result.proposals.map((proposal) => proposal.createdByAccountId),
    )
    if (participants instanceof Error) {
      throw new InternalError("failed to resolve application owners")
    }
    const participantByAccount = new Map(
      participants.map((participant) => [participant.accountId, participant]),
    )
    return c.json(
      zAppApplicationAdminList.parse({
        data: result.proposals.map((proposal) => {
          const participant = participantByAccount.get(proposal.createdByAccountId)
          if (participant === undefined) {
            throw new InternalError("application owner is not linked to a Company employee")
          }
          return {
            id: proposal.number,
            template_code: proposal.procedureKey,
            template_name: proposal.title,
            template_category: proposal.category,
            applicant_id: participant.employeeId,
            applicant_name: participant.employeeName,
            applicant_dept_name: participant.departmentName,
            current_step: toApplicationCurrentStep(proposal),
            status: toApplicationStatus(proposal.status),
            created_at: proposal.createdAt.toISOString(),
          }
        }),
        total: result.total,
      }),
      200,
    )
  },
)
