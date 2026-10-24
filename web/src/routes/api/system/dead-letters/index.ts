// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemDeadLettersRoute from "@system/interface/routes/system.dead-letters"

export const GET = voidApiRoute("GET", "/system/dead-letters", systemDeadLettersRoute.GET)
