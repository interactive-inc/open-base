import { SystemBrowserLoginCodeUnavailableError } from "@system/interface/errors"
/** /system/browser-login-codes */
import { CreateSystemBrowserLoginCode } from "@system/application/auth/create-system-browser-login-code"
import { authenticateSystemAccessToken } from "@system/interface/middlewares/authenticate-system-access-token"
import { systemFactory } from "@system/interface/request-environment/system-factory"

// @authorization owner - 認証済みSystem Account自身へだけone-time codeを発行する
export const POST = systemFactory.createHandlers(authenticateSystemAccessToken, async (context) => {
  const creation = await new CreateSystemBrowserLoginCode(context).execute(context.var.userId)
  if (creation instanceof Error) throw new SystemBrowserLoginCodeUnavailableError()

  return context.json({ code: creation.code, expires_in: creation.expiresInSeconds }, 201)
})
