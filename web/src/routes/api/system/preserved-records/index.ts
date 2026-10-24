// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemPreservedRecordsRoute from "@system/interface/routes/system.preserved-records"

export const GET = voidApiRoute("GET", "/system/preserved-records", systemPreservedRecordsRoute.GET)
