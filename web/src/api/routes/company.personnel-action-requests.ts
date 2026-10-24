import { CreatePersonnelActionRequest } from "@/api/http/personnel-action-requests/create-personnel-action-request"
import { ListPersonnelActionRequests } from "@/api/http/personnel-action-requests/list-personnel-action-requests"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { BadRequestError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { CompanyOperationError } from "@/contexts/company/domain/errors"
import {
  resolvePersonnelActionInput,
  wirePersonnelActionInputSchema,
} from "@/contexts/company/interface/operations/resolve-personnel-action-input"
import { toHttpException as toCompanyHttpException } from "@/contexts/company/interface/operations/to-http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const requestSchema = z.strictObject({
  action: wirePersonnelActionInputSchema,
  base_company_revision: z.number().int().nonnegative(),
  base_employee_revision: z.number().int().nonnegative(),
  base_organization_revision: z.number().int().nonnegative().nullable(),
})

// @authorization service - System workflow参加者scopeとCompany権限を合成する
export const GET = factory.createHandlers(
  verifyBearer,
  zValidator(
    "query",
    z.object({
      target_employee_code: z.string().trim().min(1).max(64).optional(),
      status: z.enum(["pending", "approved", "rejected", "withdrawn"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }),
  ),
  async (context) => {
    const session = context.var.session
    if (session === null) throw new UnauthorizedError()
    const query = context.req.valid("query")
    const requests = await new ListPersonnelActionRequests(context).execute(session, {
      targetEmployeeCode: query.target_employee_code,
      status: query.status,
      limit: query.limit,
    })
    if (requests instanceof ApplicationError) throw toHttpException(requests)
    return context.json(
      {
        requests: requests.map((request) => ({
          id: request.id,
          application_id: request.applicationId,
          target_employee_code: request.targetEmployeeCode,
          target_employee_name: request.targetEmployeeName,
          requested_by_employee_code: request.requestedByEmployeeCode,
          requested_by_employee_name: request.requestedByEmployeeName,
          kind: request.kind,
          status: request.status,
          current_step: request.currentStep,
          created_at: new Date(request.createdAt * 1_000).toISOString(),
          applied_action_id: request.appliedActionId,
          withdrawn_at:
            request.withdrawnAt === null
              ? null
              : new Date(request.withdrawnAt * 1_000).toISOString(),
        })),
      },
      200,
    )
  },
)

// @authorization permission - employee:lifecycle:requestと組織scopeをApplicationで検証する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", requestSchema),
  async (context) => {
    const session = context.var.session
    if (session === null) throw new UnauthorizedError()
    const idempotencyKey = context.req.header("Idempotency-Key")
    if (idempotencyKey === undefined || !z.uuid().safeParse(idempotencyKey).success) {
      throw new BadRequestError("A UUID Idempotency-Key is required")
    }
    const body = context.req.valid("json")
    const input = await resolvePersonnelActionInput(
      context,
      body.action,
      body.base_company_revision,
    )
    if (input instanceof CompanyOperationError) throw toCompanyHttpException(input)
    const result = await new CreatePersonnelActionRequest(context).execute({
      idempotencyKey,
      input,
      baseCompanyRevision: body.base_company_revision,
      baseEmployeeRevision: body.base_employee_revision,
      baseOrganizationRevision: body.base_organization_revision,
      createdAt: context.var.now(),
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return context.json(
      {
        id: result.id,
        application_id: result.applicationId,
        target_employee_code: result.targetEmployeeCode,
        kind: result.kind,
        status: result.status,
        current_step: result.currentStep,
        created_at: result.createdAt,
        replayed: result.replayed,
      },
      result.replayed ? 200 : 201,
    )
  },
)
