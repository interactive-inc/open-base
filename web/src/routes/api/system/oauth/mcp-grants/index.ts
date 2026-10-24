// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemOauthMcpGrantsRoute from "@system/interface/routes/system.oauth.mcp-grants"

export const POST = voidApiRoute("POST", "/system/oauth/mcp-grants", systemOauthMcpGrantsRoute.POST)
