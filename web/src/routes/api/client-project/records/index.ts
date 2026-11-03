// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as clientProjectRecordsRoute from "@/contexts/client-project/interface/routes/client-project.records"

export const GET = voidApiRoute("GET", "/client-project/records", clientProjectRecordsRoute.GET)
export const POST = voidApiRoute("POST", "/client-project/records", clientProjectRecordsRoute.POST)
