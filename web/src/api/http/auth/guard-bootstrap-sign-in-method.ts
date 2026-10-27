import { factory } from "@/api/http/factory"
import { BadRequestError } from "@/lib/http/errors"
import { readSignInMethod } from "./sign-in-method"

/** 初期アカウントを、その配備でサインインできない方式では作らない。 */
export const guardBootstrapSignInMethod = factory.createMiddleware(async (context, next) => {
  if (context.req.method === "POST" && context.env.BOOTSTRAP_TOKEN) {
    const body: unknown = await context.req.json().catch(() => null)
    if (typeof body === "object" && body !== null && "email" in body) {
      const requested = "method" in body ? body.method : "password"
      if (requested !== readSignInMethod(context.env)) {
        throw new BadRequestError("初期登録の方式を、配備で選んだ認証方式に合わせてください")
      }
    }
  }
  await next()
})
