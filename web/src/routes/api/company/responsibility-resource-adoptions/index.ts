// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyResponsibilityResourceAdoptionsRoute from "@/contexts/company/interface/routes/company.responsibility-resource-adoptions"

export const GET = voidApiRoute(
  "GET",
  "/company/responsibility-resource-adoptions",
  companyResponsibilityResourceAdoptionsRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/company/responsibility-resource-adoptions",
  companyResponsibilityResourceAdoptionsRoute.POST,
)
