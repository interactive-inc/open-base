// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyEmployeeResourceAdoptionsRoute from "@/contexts/company/interface/routes/company.employee-resource-adoptions"

export const GET = voidApiRoute(
  "GET",
  "/company/employee-resource-adoptions",
  companyEmployeeResourceAdoptionsRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/company/employee-resource-adoptions",
  companyEmployeeResourceAdoptionsRoute.POST,
)
