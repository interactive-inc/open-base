// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as offeringRecordsRoute from "@/contexts/offering/interface/routes/offering.records"

export const GET = voidApiRoute("GET", "/offering/records", offeringRecordsRoute.GET)
export const POST = voidApiRoute("POST", "/offering/records", offeringRecordsRoute.POST)
