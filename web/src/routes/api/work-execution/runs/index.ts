// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as workExecutionRunsRoute from "@/contexts/work-execution/interface/routes/work-execution.runs"

export const GET = voidApiRoute("GET", "/work-execution/runs", workExecutionRunsRoute.GET)
export const POST = voidApiRoute("POST", "/work-execution/runs", workExecutionRunsRoute.POST)
