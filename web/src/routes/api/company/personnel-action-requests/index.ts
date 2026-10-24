// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyPersonnelActionRequestsRoute from "@/api/routes/company.personnel-action-requests"

export const GET = voidApiRoute(
  "GET",
  "/company/personnel-action-requests",
  companyPersonnelActionRequestsRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/company/personnel-action-requests",
  companyPersonnelActionRequestsRoute.POST,
)
