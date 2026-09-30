import type { EmployeeId } from "@/contexts/company/domain/definitions/workforce-id.definition"
import {
  submitSystemApplication,
  systemProposalQuery,
} from "@/api/http/application-requests/lib/system-application-operation"
import {
  parseSystemApplicationBody,
  toApplicationCurrentStep,
  toApplicationStatus,
  toSystemStatuses,
} from "@/api/http/application-requests/lib/system-application-view"
import { resolveCompanyAccountParticipants } from "@/api/http/accounts/resolve-company-account-participants"
import { resolveSystemAccountIdsForEmployees } from "@/api/http/accounts/resolve-system-account-ids-for-employees"
import {
  ForbiddenError,
  InternalError,
  UnauthorizedError,
  UnprocessableEntityError,
} from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { verifyBearer } from "@/api/http/verify-bearer"
import { factory } from "@/api/http/factory"
import { jsonPayloadSchema } from "@/lib/http/json-payload-schema"
import { listDepartmentEmployeeIds } from "@/api/http/company-employees/list-department-employee-ids"
import {
  DEFAULT_LIST_LIMIT,
  MAX_LIST_LIMIT,
  MAX_LIST_OFFSET,
  toBoundedInt,
} from "@/lib/http/to-bounded-int"
import { zAppApplication, zAppApplicationAdminList } from "@/api/http/company/response-schemas"
import { ApplicationError } from "@/lib/errors"
import { toApplicationDecisionTarget } from "@/api/http/application-requests/lib/to-application-decision-target"
import { codeSchema } from "@/lib/validation/code.schema"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

// @authorization permission - 権限キーとCompany組織範囲で判定する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      scope: z.enum(["department"]).optional(),
      department_code: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  ),
  async (c) => {
    const session = c.var.session
    if (session === null) throw new UnauthorizedError()
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
    let employeeIds: ReadonlyArray<EmployeeId>
    if (query.scope === "department") {
      const departmentCode = query.department_code ?? null
      if (departmentCode === null) {
        throw new UnprocessableEntityError("department_code is required for scope=department")
      }
      const departmentEmployeeIds = await listDepartmentEmployeeIds({ c, departmentCode })
      if (departmentEmployeeIds instanceof Error) {
        throw new InternalError("failed to resolve department employees")
      }
      employeeIds = departmentEmployeeIds
      const allowed =
        session.hasPermission("application:read:all") ||
        (session.hasPermission("application:read:department") &&
          employeeIds.includes(session.employeeId))
      if (!allowed) throw new ForbiddenError()
    } else {
      employeeIds = [session.employeeId]
    }
    const accountIds = await resolveSystemAccountIdsForEmployees(c, employeeIds)
    if (accountIds instanceof Error) {
      throw new InternalError("failed to resolve application owners")
    }
    const result = await systemProposalQuery(c).list({
      creatorAccountIds: accountIds,
      actorAccountId: null,
      statuses: toSystemStatuses(query.status),
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
          return {
            id: proposal.number,
            template_code: proposal.procedureKey,
            template_name: proposal.title,
            template_category: proposal.category,
            applicant_id: participant?.employeeId ?? 0,
            applicant_name: participant?.employeeName ?? "",
            applicant_dept_name: participant?.departmentName ?? null,
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

// @authorization owner - 本人のリソースに限定する
/** POST /application-requests — 本人として申請を作成 */
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator(
    "json",
    z.object({
      template_code: codeSchema,
      payload: jsonPayloadSchema(10_000),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")

    const session = c.var.session

    if (session === null) {
      throw new UnauthorizedError()
    }

    const created = await submitSystemApplication(c, {
      applicantId: session.employeeId,
      templateCode: body.template_code,
      payload: body.payload,
      createdAt: new Date(c.env.NOW ?? Date.now()),
    })

    if (created instanceof ApplicationError) {
      throw toHttpException(created)
    }

    const payload = parseSystemApplicationBody(created.proposal)
    if (payload instanceof Error) throw new InternalError("invalid application payload")
    const responseBody = zAppApplication.parse({
      id: created.proposal.number,
      decision_target: toApplicationDecisionTarget(created.proposal),
      can_decide: false,
      template_code: created.proposal.procedureKey,
      template_name: created.proposal.title,
      applicant_name: created.applicantName,
      status: toApplicationStatus(created.proposal.status),
      current_step: toApplicationCurrentStep(created.proposal),
      payload: payload.value,
      created_at: created.proposal.createdAt.toISOString(),
      approver_roles: [...created.approverRoles],
    })

    return c.json(responseBody, 201)
  },
)
