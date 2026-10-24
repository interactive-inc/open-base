// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemCliSessionsRoute from "@system/interface/routes/system.cli-sessions"

export const POST = voidApiRoute("POST", "/system/cli-sessions", systemCliSessionsRoute.POST)
