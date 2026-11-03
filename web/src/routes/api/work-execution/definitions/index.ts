// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as workExecutionDefinitionsRoute from "@/contexts/work-execution/interface/routes/work-execution.definitions"

export const GET = voidApiRoute(
  "GET",
  "/work-execution/definitions",
  workExecutionDefinitionsRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/work-execution/definitions",
  workExecutionDefinitionsRoute.POST,
)
