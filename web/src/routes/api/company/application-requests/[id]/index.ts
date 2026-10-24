// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyApplicationRequestsIdRoute from "@/api/routes/company.application-requests.$id"

export const GET = voidApiRoute(
  "GET",
  "/company/application-requests/:id",
  companyApplicationRequestsIdRoute.GET,
)
export const PUT = voidApiRoute(
  "PUT",
  "/company/application-requests/:id",
  companyApplicationRequestsIdRoute.PUT,
)
export const DELETE = voidApiRoute(
  "DELETE",
  "/company/application-requests/:id",
  companyApplicationRequestsIdRoute.DELETE,
)
