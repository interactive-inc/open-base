// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemNotificationsRoute from "@system/interface/routes/system.notifications"

export const GET = voidApiRoute("GET", "/system/notifications", systemNotificationsRoute.GET)
export const POST = voidApiRoute("POST", "/system/notifications", systemNotificationsRoute.POST)
export const PATCH = voidApiRoute("PATCH", "/system/notifications", systemNotificationsRoute.PATCH)
