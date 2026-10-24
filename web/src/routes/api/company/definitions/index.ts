// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyDefinitionsRoute from "@/contexts/company/interface/routes/company.definitions"

export const GET = voidApiRoute("GET", "/company/definitions", companyDefinitionsRoute.GET)
export const POST = voidApiRoute("POST", "/company/definitions", companyDefinitionsRoute.POST)
