// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemWorkItemsIdRoute from "@system/interface/routes/system.work-items.$id"

export const GET = voidApiRoute("GET", "/system/work-items/:id", systemWorkItemsIdRoute.GET)
