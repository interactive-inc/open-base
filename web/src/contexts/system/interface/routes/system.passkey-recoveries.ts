import { SystemBootstrapTokenValue } from "@system/domain/values/auth/system-bootstrap-token.value"
import {
  SystemBootstrapCredentialInvalidError,
  SystemBootstrapUnavailableError,
  SystemNotFoundError,
} from "@system/interface/errors"
import { findSystemPasskeyAccountByEmail } from "@system/interface/operations/find-system-passkey-account-by-email"
import { issueSystemPasskeyEnrollment } from "@system/interface/operations/issue-system-passkey-enrollment"
import { systemFactory } from "@system/interface/request-environment/system-factory"
import { timingSafeStringEqual } from "@system/lib/auth/timing-safe-string-equal"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** 復旧用の招待は短くする。運用者がその場で渡して使う前提。 */
const RECOVERY_LIFETIME_MILLISECONDS = 60 * 60 * 1_000

// @authorization public - 運用者が持つbootstrap secretでだけ、Accountへ復旧用のパスキー招待を発行する
export const POST = systemFactory.createHandlers(
  systemFactory.createMiddleware(async (context, next) => {
    if (SystemBootstrapTokenValue.create(context.env.BOOTSTRAP_TOKEN) === null) {
      throw new SystemNotFoundError()
    }
    await next()
  }),
  zValidator(
    "json",
    z
      .object({
        token: z.string().min(16).max(4096),
        email: z.string().trim().toLowerCase().email().min(3).max(254),
      })
      .strict(),
  ),
  async (context) => {
    const expectedToken = context.env.BOOTSTRAP_TOKEN
    if (SystemBootstrapTokenValue.create(expectedToken) === null || expectedToken === undefined) {
      throw new SystemNotFoundError()
    }
    const body = context.req.valid("json")
    if (!(await timingSafeStringEqual(body.token, expectedToken))) {
      throw new SystemBootstrapCredentialInvalidError()
    }
    const now = context.var.now()
    if (!Number.isSafeInteger(now.getTime())) throw new SystemBootstrapUnavailableError()

    const systemContext = { env: { DB: context.env.DB } }
    const accountId = await findSystemPasskeyAccountByEmail(systemContext, body.email)
    if (accountId instanceof Error) throw new SystemBootstrapUnavailableError()
    if (accountId === null) throw new SystemNotFoundError()
    const enrollment = await issueSystemPasskeyEnrollment(systemContext, {
      accountId,
      reason: "recovery",
      issuedByAccountId: null,
      now,
      lifetimeMilliseconds: RECOVERY_LIFETIME_MILLISECONDS,
    })
    if (enrollment instanceof Error) throw new SystemBootstrapUnavailableError()
    if (enrollment === "no_identity") throw new SystemNotFoundError()

    return context.json(
      {
        account_id: accountId,
        token: enrollment.token,
        expires_at: enrollment.expiresAt.toISOString(),
      },
      201,
    )
  },
)
