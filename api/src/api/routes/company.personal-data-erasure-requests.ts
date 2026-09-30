import { submitSystemAttachmentErasure } from "@/api/http/application-requests/lib/system-application-operation"
import { resolveSystemAccountIdsForEmployees } from "@/api/http/accounts/resolve-system-account-ids-for-employees"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { openCompanyEmployeeDirectory } from "@/contexts/company/interface/operations/open-company-employee-directory"
import { ApplicationError } from "@/lib/errors"
import { InternalError, NotFoundError, UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

const requestSchema = z.strictObject({
  request_id: z.uuid(),
  template_code: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(1).max(1_000),
  target: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("attachment"), attachment_id: z.string().min(1).max(64) }),
    z.strictObject({
      kind: z.literal("employee"),
      employee_code: z.string().trim().min(1).max(64),
    }),
  ]),
})

/**
 * 個人情報を含む添付の消去を申請する。従業員を指定した場合はCompanyが従業員からAccountを解決し、
 * そのAccountが所有する添付をSystemが申請時点で固定する。鍵の破棄は承認の確定後にだけ行う。
 */
// @authorization service - personal_data:erase または system:admin をSystem operationが検査する
export const POST = factory.createHandlers(
  verifyBearer,
  zValidator("json", requestSchema),
  async (context) => {
    const session = context.var.session
    if (session === null) throw new UnauthorizedError()
    const body = context.req.valid("json")
    let scope: unknown
    if (body.target.kind === "attachment") {
      scope = { kind: "attachment", attachmentId: body.target.attachment_id }
    } else {
      const employee = await openCompanyEmployeeDirectory(context).findByCode(
        body.target.employee_code,
      )
      if (employee instanceof Error) throw new InternalError("failed to find employee")
      if (employee === null) throw new NotFoundError("employee not found")
      const accountIds = await resolveSystemAccountIdsForEmployees(context, [employee.id])
      if (accountIds instanceof Error) throw new InternalError("failed to resolve employee account")
      const accountId = accountIds[0]
      if (accountId === undefined || accountIds.length !== 1)
        throw new NotFoundError("employee account not found")
      scope = { kind: "account", accountId }
    }
    const result = await submitSystemAttachmentErasure(context, {
      applicantId: session.employeeId,
      templateCode: body.template_code,
      requestId: body.request_id,
      scope,
      reason: body.reason,
      createdAt: context.var.now(),
    })
    if (result instanceof ApplicationError) throw toHttpException(result)
    return context.json(
      {
        application_id: result.proposal.number,
        request_id: result.proposal.seriesId,
        status: result.proposal.status,
        current_step: result.proposal.currentTaskKey,
      },
      201,
    )
  },
)
