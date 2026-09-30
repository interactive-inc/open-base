import { authenticateSystemBearer } from "@/api/http/authenticate-system-bearer"
import { factory } from "@/api/http/factory"
import { hasExternalAccessTokenHeader } from "@system/lib/auth/has-external-access-token-header"
import { CreateSystemBrowserLoginCode } from "@system/application/auth/create-system-browser-login-code"
import { SystemBrowserLoginCodeUnavailableError } from "@system/interface/errors"
import { readBearerAuthorization } from "@system/interface/operations/bearer-authorization"

/** 製品が受理するBearerをSystem Accountへ解決し、Web引き継ぎcodeを発行する。 */
export const issueSystemBrowserLoginCode = factory.createMiddleware(async (c, next) => {
  const authorization = readBearerAuthorization(c.req.header("authorization"))
  if (authorization.kind !== "token" || !hasExternalAccessTokenHeader(authorization.token)) {
    await next()
    return
  }

  await authenticateSystemBearer(c)

  const creation = await new CreateSystemBrowserLoginCode(c).execute(c.var.userId)
  if (creation instanceof Error) throw new SystemBrowserLoginCodeUnavailableError()

  return c.json({ code: creation.code, expires_in: creation.expiresInSeconds }, 201)
})
