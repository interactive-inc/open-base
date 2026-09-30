import { AcceptPasswordResetRequest } from "@system/application/auth/accept-password-reset-request"
import { CreatePasswordResetChallenge } from "@system/application/auth/create-password-reset-challenge"
import { ResetPassword } from "@/contexts/system/application/auth/reset-password"
import { PasswordResetRequestApplicationError } from "@system/application/errors"
import { EmailValue } from "@/contexts/system/domain/values/identity/email.value"
import { identitySubjectSchema } from "@/contexts/system/domain/schemas/identity/identity-subject.schema"
import { FindSystemPasswordResetRecipientAdapter } from "@system/infrastructure/adapters/auth/find-system-password-reset-recipient.adapter"
import { systemFactory } from "@/contexts/system/interface/request-environment/system-factory"
import { SystemApplicationError, SystemInternalServerError } from "@system/interface/errors"
import { zAppAuthAcknowledgement } from "@/contexts/system/interface/models/auth"
import { ApplicationError } from "@system/application/errors"
import { zValidator } from "@hono/zod-validator"
import { z } from "zod"

/** パスワード再設定メールの受付。 */
// @authorization public - Accountの実在を漏らさず常に同じ受付結果を返す
export const POST = systemFactory.createHandlers(
  zValidator(
    "json",
    z.object({
      email: EmailValue.schema.pipe(identitySubjectSchema),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")
    const clientIp = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? null
    const accepted = await new AcceptPasswordResetRequest(c).execute({
      email: body.email,
      clientIp,
    })
    const recipient = accepted
      ? await new FindSystemPasswordResetRecipientAdapter(c).findSystemPasswordResetRecipient(
          body.email,
        )
      : null
    if (recipient instanceof Error) {
      const error = new PasswordResetRequestApplicationError(recipient)
      throw new SystemApplicationError(error)
    }

    const requestOutcome = await new CreatePasswordResetChallenge(c).execute({
      origin: new URL(c.req.url).origin,
      recipient,
    })

    if (requestOutcome instanceof Error) {
      if (requestOutcome instanceof ApplicationError) {
        throw new SystemApplicationError(requestOutcome)
      }

      throw new SystemInternalServerError(requestOutcome)
    }

    return c.json(zAppAuthAcknowledgement.parse({ item: requestOutcome }))
  },
)

/** raw tokenを消費し、password変更と全Session失効を不可分に行う。 */
// @authorization public - challenge possessionを認証要素とし、拒否理由は同じ応答へ畳む
export const PATCH = systemFactory.createHandlers(
  zValidator(
    "json",
    z.object({
      token: z.string().regex(/^[a-f0-9]{64}$/),
      new_password: z.string().min(12).max(200),
    }),
  ),
  async (c) => {
    const body = c.req.valid("json")
    const completionOutcome = await new ResetPassword(c).execute({
      rawToken: body.token,
      newPassword: body.new_password,
    })

    if (completionOutcome instanceof Error) {
      if (completionOutcome instanceof ApplicationError) {
        throw new SystemApplicationError(completionOutcome)
      }

      throw new SystemInternalServerError(completionOutcome)
    }

    return c.json(zAppAuthAcknowledgement.parse({ item: completionOutcome }))
  },
)
