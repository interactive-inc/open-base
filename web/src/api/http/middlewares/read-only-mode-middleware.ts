import type { HonoEnv } from "@/bindings"
import { ForbiddenError } from "@/lib/http/errors"
import { createMiddleware } from "hono/factory"

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

// ログイン、トークン更新、ログアウトは読み取り専用でも通す。
const SESSION_PATHS = new Set([
  "/system/sessions",
  "/system/identity-sessions",
  "/system/browser-sessions",
  "/system/browser-login-codes",
])

/** READ_ONLY_MODE が未設定・空・"false" 以外なら読み取り専用とみなす。不正値は安全側に倒す。 */
export function isReadOnlyMode(value: string | undefined): boolean {
  if (value === undefined) {
    return false
  }

  const normalized = value.trim()

  return normalized !== "" && normalized !== "false"
}

/**
 * 公開デモなど、データを変更させない配備のための読み取り専用モード。
 * READ_ONLY_MODE が有効なとき、セッション系を除く読み取り以外の要求を 403 で拒否する。
 * Account の権限に関係なく、管理者の書き込みも止める。
 */
export const readOnlyModeMiddleware = createMiddleware<HonoEnv>(async (c, next) => {
  if (!isReadOnlyMode(c.env.READ_ONLY_MODE)) {
    await next()

    return
  }

  if (READ_METHODS.has(c.req.method) || SESSION_PATHS.has(c.req.path)) {
    await next()

    return
  }

  throw new ForbiddenError("this deployment is read-only")
})
