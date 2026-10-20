import { authenticateSystemBearer } from "@/api/http/authenticate-system-bearer"
import { factory } from "@/api/http/factory"
import { hasExternalAccessTokenHeader } from "@system/lib/auth/has-external-access-token-header"
import { CreateSystemBrowserLoginCode } from "@system/application/auth/create-system-browser-login-code"
import {
  SystemBrowserLoginCodeUnavailableError,
  SystemInvalidSessionError,
} from "@system/interface/errors"
import { readBearerAuthorization } from "@system/interface/operations/bearer-authorization"

/** 製品が受理するBearerをSystem Accountへ解決し、Web引き継ぎcodeを発行する。 */
export const issueSystemBrowserLoginCode = factory.createMiddleware(async (c, next) => {
  const authorization = readBearerAuthorization(c.req.header("authorization"))
  if (authorization.kind !== "token" || !hasExternalAccessTokenHeader(authorization.token)) {
    await next()
    return
  }

  await authenticateSystemBearer(c)
  const authentication = c.var.bearerReadAuthentication
  if (authentication === undefined) throw new SystemInvalidSessionError()

  const creation = await new CreateSystemBrowserLoginCode(c).execute({
    authentication,
    sessionFamilyId: c.var.systemAccessToken?.sid ?? null,
  })
  if (creation instanceof Error) throw new SystemBrowserLoginCodeUnavailableError()

  // 発行を求めた認証の世代や発行元が保存の時点で失効していれば、codeを発行しない。
  if (creation === null) throw new SystemInvalidSessionError()

  return c.json({ code: creation.code, expires_in: creation.expiresInSeconds }, 201)
})
