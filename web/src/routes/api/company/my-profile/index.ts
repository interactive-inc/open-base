// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyMyProfileRoute from "@/contexts/company/interface/routes/company.my-profile"

export const GET = voidApiRoute("GET", "/company/my-profile", companyMyProfileRoute.GET)
export const PUT = voidApiRoute("PUT", "/company/my-profile", companyMyProfileRoute.PUT)
