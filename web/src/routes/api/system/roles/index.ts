// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemRolesRoute from "@system/interface/routes/system.roles"

export const GET = voidApiRoute("GET", "/system/roles", systemRolesRoute.GET)
export const POST = voidApiRoute("POST", "/system/roles", systemRolesRoute.POST)
