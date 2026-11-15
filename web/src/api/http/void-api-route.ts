import { readSignInMethod } from "@/api/http/auth/sign-in-method"
import { createAppBase } from "@/api/app-base"
import { readSignedInSession } from "@/api/http/auth/read-signed-in-session"
import type { RouteMethod } from "@/api/http/lazy-route-handlers"
import { SystemSignedInSessionChannel } from "@system/interface/request-environment/system-signed-in-session-channel"
import type { Context, MiddlewareHandler } from "hono"
import { getSession } from "void/auth"

/** Voidが `/api` の下へ公開するAPIの接頭辞。Honoのrouteは接頭辞なしの経路で登録する。 */
const API_PREFIX = "/api"

/**
 * context routeのhandler列を、Voidのroute fileから呼べる1つのhandlerにする。
 *
 * 共通middleware（認証、CORS、入力上限、監査、エラー変換）は `createAppBase` が持つ。
 * route fileごとに、その経路だけを載せたappを作り、`/api` を外した要求を通す。
 * Voidが検証したBetter Authのセッションは、envの複製へ結び付けてSystemへ渡す。
 * route fileはVoidが要求された経路の分だけ読み込むので、全routeを評価しない。
 */
export function voidApiRoute(method: RouteMethod, path: string, exported: unknown) {
  const app = routeApp(method, path, exported)

  return async (c: Context) => {
    const url = new URL(c.req.url)
    if (!url.pathname.startsWith(`${API_PREFIX}/`)) return c.notFound()
    url.pathname = url.pathname.slice(API_PREFIX.length)
    return app.fetch(new Request(url.toString(), c.req.raw), signedInEnv(c), executionContextOf(c))
  }
}

/** その経路だけを載せたappを作る。 */
function routeApp(method: RouteMethod, path: string, exported: unknown) {
  const handlers = (Array.isArray(exported) ? exported : [exported]) as MiddlewareHandler[]
  if (handlers.length === 0 || handlers.some((handler) => typeof handler !== "function")) {
    throw new Error(`route module does not export ${method} handlers: ${path}`)
  }
  const app = createAppBase()
  app.on(method, path, ...(handlers as [MiddlewareHandler]))
  return app
}

/** 画面のloaderが最初の表示に使う、APIの読み取り結果。 */
export type PageApiJson<T> = { kind: "ok"; data: T } | { kind: "forbidden" } | { kind: "error" }

/**
 * 画面のloaderから、APIのGETをWorkerの中で呼ぶ。
 *
 * ブラウザーが `/api` を読むときと同じ共通middlewareとhandlerを通すので、認可と失敗の扱いは変わらない。
 * 画面を開いた要求のcookieとセッションをそのまま使い、外へのHTTP要求は出さない。
 * 応答の分け方はブラウザー側の `useApiJson` と合わせる。
 */
export function pageApiReader(pattern: string, exported: unknown) {
  const app = routeApp("GET", pattern, exported)

  /** `path` は経路に `:id` などがあるとき、実際の値とクエリを入れた経路を渡す。応答の型は呼ぶ側が決める。 */
  return async <T>(c: Context, path: string = pattern): Promise<PageApiJson<T>> => {
    const request = new Request(new URL(path, c.req.url).toString(), {
      headers: c.req.raw.headers,
    })
    try {
      const response = await app.fetch(request, signedInEnv(c), executionContextOf(c))
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return { kind: "forbidden" }
      }
      if (!response.ok) return { kind: "error" }
      return { kind: "ok", data: (await response.json()) as T }
    } catch {
      return { kind: "error" }
    }
  }
}

/** Voidが検証したBetter Authのセッションを、envの複製へ結び付ける。 */
function signedInEnv(c: Context): Context["env"] {
  const session = readSignedInSession(getSession(), readSignInMethod(c.env))
  return session === null ? c.env : new SystemSignedInSessionChannel({ env: c.env }).attach(session)
}

/** Honoは実行文脈が無いと例外を投げる。テストなど実行文脈の無い呼び出しではundefinedを渡す。 */
function executionContextOf(c: Context): Context["executionCtx"] | undefined {
  try {
    return c.executionCtx
  } catch {
    return undefined
  }
}
