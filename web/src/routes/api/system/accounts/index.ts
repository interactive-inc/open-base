// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemAccountsRoute from "@system/interface/routes/system.accounts"

export const GET = voidApiRoute("GET", "/system/accounts", systemAccountsRoute.GET)
export const POST = voidApiRoute("POST", "/system/accounts", systemAccountsRoute.POST)
