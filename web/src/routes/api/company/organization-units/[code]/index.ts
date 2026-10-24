// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyOrganizationUnitsCodeRoute from "@/contexts/company/interface/routes/company.organization-units.$code"

export const GET = voidApiRoute(
  "GET",
  "/company/organization-units/:code",
  companyOrganizationUnitsCodeRoute.GET,
)
export const PUT = voidApiRoute(
  "PUT",
  "/company/organization-units/:code",
  companyOrganizationUnitsCodeRoute.PUT,
)
export const DELETE = voidApiRoute(
  "DELETE",
  "/company/organization-units/:code",
  companyOrganizationUnitsCodeRoute.DELETE,
)
