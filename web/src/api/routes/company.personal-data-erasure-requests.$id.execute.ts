import { executeSystemApplicationErasure } from "@/api/http/application-requests/lib/system-application-operation"
import { factory } from "@/api/http/factory"
import { verifyBearer } from "@/api/http/verify-bearer"
import { ApplicationError } from "@/lib/errors"
import { UnauthorizedError } from "@/lib/http/errors"
import { toHttpException } from "@/lib/http/to-http-exception"
import { validateIntParam } from "@/lib/http/validate-int-param"

/**
 * 最終承認者が消去権限を持たず、承認済みのまま残った消去案件を確定する。
 * 承認前・否決後の案件、権限の無い人、二度目の破棄はSystem operationが拒否する。
 */
// @authorization service - personal_data:erase または system:admin と承認済み案件をSystem operationが検査する
export const POST = factory.createHandlers(verifyBearer, async (context) => {
  const applicationId = validateIntParam(context.req.param("id"), "application")
  if (context.var.session === null) throw new UnauthorizedError()
  const result = await executeSystemApplicationErasure(context, applicationId, context.var.now())
  if (result instanceof ApplicationError) throw toHttpException(result)
  return context.json({ status: result.kind, attachment_ids: result.attachmentIds }, 200)
})
