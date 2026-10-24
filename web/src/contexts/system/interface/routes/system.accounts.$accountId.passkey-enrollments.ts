import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import {
  SystemAccountNotFoundError,
  SystemForbiddenError,
  SystemIdentityUnavailableError,
  SystemInvalidSessionError,
} from "@system/interface/errors"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { requireSystemStepUp } from "@system/interface/middlewares/require-system-step-up"
import { issueSystemPasskeyEnrollment } from "@system/interface/operations/issue-system-passkey-enrollment"
import { systemFactory } from "@system/interface/request-environment/system-factory"

// @authorization permission iam:write - 再認証した管理者が、パスキーを失くしたAccountへ招待を発行し直す
export const POST = systemFactory.createHandlers(
  authenticateSystemAccessToken,
  requireSystemStepUp,
  async (context) => {
    if (!context.var.permissions.has("system:admin") && !context.var.permissions.has("iam:write")) {
      throw new SystemForbiddenError()
    }
    const actorAccountId = zAccountId.safeParse(context.var.userId)
    if (!actorAccountId.success) throw new SystemInvalidSessionError()
    const accountId = zAccountId.safeParse(context.req.param("accountId"))
    if (!accountId.success) throw new SystemAccountNotFoundError()
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) throw new SystemIdentityUnavailableError()

    const enrollment = await issueSystemPasskeyEnrollment(
      { env: { DB: context.env.DB } },
      { accountId: accountId.data, reason: "reissue", issuedByAccountId: actorAccountId.data, now },
    )
    if (enrollment instanceof Error) throw new SystemIdentityUnavailableError()
    if (enrollment === "no_identity") throw new SystemAccountNotFoundError()

    return context.json(
      {
        account_id: accountId.data,
        identity_id: enrollment.identityId,
        token: enrollment.token,
        expires_at: enrollment.expiresAt.toISOString(),
      },
      201,
    )
  },
)
