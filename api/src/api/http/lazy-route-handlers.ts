import { handleApiError } from "@/api/error-response/handle-api-error"
import type { HonoEnv } from "@/env"
import type { Context, MiddlewareHandler, Next } from "hono"

export type RouteMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

type RouteHandler = (c: Context<HonoEnv>, next: Next) => unknown
type RouteModule = Partial<Record<RouteMethod, unknown>>
/** route moduleを動的importで読む関数。生成物は1関数ずつこの型で宣言し、型検査を局所に保つ。 */
export type RouteModuleLoader = () => Promise<RouteModule>

/**
 * route moduleを最初の要求時に読み込み、その handler 列を静的登録と同じ規則で実行する。
 *
 * Workerで全route moduleを評価するとisolateのメモリ上限を超え、isolateが要求ごとに
 * 作り直されて毎回全評価のCPUを払う。実行時のappは経路と読み込み関数だけを持ち、
 * module評価を要求された経路の分に限る。
 *
 * 各handlerの例外はHonoのcomposeと同じく、その位置でapp共通のエラーハンドラへ渡す。
 * 外側のmiddlewareは静的登録のときと同じく、完了した next() と確定した応答を観測する。
 * `c.req.routeIndex` は外側の経路のものを保つ（handler列はすべて同じ経路のparamを読む）。
 */
export function lazyRouteHandlers(
  load: RouteModuleLoader,
  method: RouteMethod,
): MiddlewareHandler<HonoEnv> {
  let loading: Promise<readonly RouteHandler[]> | undefined

  const resolveHandlers = () => {
    loading ??= load().then(
      (routeModule) => {
        const exported = routeModule[method]
        const handlers = Array.isArray(exported) ? exported : [exported]
        if (handlers.length === 0 || handlers.some((handler) => typeof handler !== "function")) {
          throw new Error(`route module does not export ${method} handlers`)
        }
        return handlers as RouteHandler[]
      },
      (error: unknown) => {
        // 読み込み失敗を固定しない。次の要求で読み直す。
        loading = undefined
        throw error
      },
    )
    return loading
  }

  return async (c, next) => {
    const handlers = await resolveHandlers()
    let index = -1
    const dispatch = async (position: number): Promise<void> => {
      if (position <= index) throw new Error("next() called multiple times")
      index = position
      const handler = handlers[position]
      if (handler === undefined) {
        await next()
        return
      }
      let response: unknown
      let isError = false
      try {
        response = await handler(c, () => dispatch(position + 1))
      } catch (error) {
        if (!(error instanceof Error)) throw error
        c.error = error
        response = await handleApiError(error, c)
        isError = true
      }
      if (response instanceof Response && (!c.finalized || isError)) c.res = response
    }
    await dispatch(0)
    return c.finalized ? c.res : undefined
  }
}
