import { createAppBase } from "@/api/app-base"
import type { RouteMethod } from "@/api/http/lazy-route-handlers"
import type { Context, MiddlewareHandler } from "hono"

/** Voidが `/api` の下へ公開するAPIの接頭辞。Honoのrouteは接頭辞なしの経路で登録する。 */
const API_PREFIX = "/api"

/**
 * context routeのhandler列を、Voidのroute fileから呼べる1つのhandlerにする。
 *
 * 共通middleware（認証、CORS、入力上限、監査、エラー変換）は `createAppBase` が持つ。
 * route fileごとに、その経路だけを載せたappを作り、`/api` を外した要求を通す。
 * route fileはVoidが要求された経路の分だけ読み込むので、全routeを評価しない。
 */
export function voidApiRoute(method: RouteMethod, path: string, exported: unknown) {
  const handlers = (Array.isArray(exported) ? exported : [exported]) as MiddlewareHandler[]
  if (handlers.length === 0 || handlers.some((handler) => typeof handler !== "function")) {
    throw new Error(`route module does not export ${method} handlers: ${path}`)
  }
  const app = createAppBase()
  app.on(method, path, ...(handlers as [MiddlewareHandler]))

  return async (c: Context) => {
    const url = new URL(c.req.url)
    if (!url.pathname.startsWith(`${API_PREFIX}/`)) return c.notFound()
    url.pathname = url.pathname.slice(API_PREFIX.length)
    return app.fetch(new Request(url.toString(), c.req.raw), c.env, executionContextOf(c))
  }
}

/** Honoは実行文脈が無いと例外を投げる。テストなど実行文脈の無い呼び出しではundefinedを渡す。 */
function executionContextOf(c: Context): Context["executionCtx"] | undefined {
  try {
    return c.executionCtx
  } catch {
    return undefined
  }
}
