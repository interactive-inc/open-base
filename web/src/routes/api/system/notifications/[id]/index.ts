// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemNotificationsIdRoute from "@system/interface/routes/system.notifications.$id"

export const GET = voidApiRoute("GET", "/system/notifications/:id", systemNotificationsIdRoute.GET)
export const PATCH = voidApiRoute(
  "PATCH",
  "/system/notifications/:id",
  systemNotificationsIdRoute.PATCH,
)
export const DELETE = voidApiRoute(
  "DELETE",
  "/system/notifications/:id",
  systemNotificationsIdRoute.DELETE,
)
