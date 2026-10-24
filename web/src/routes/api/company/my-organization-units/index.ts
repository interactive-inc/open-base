// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyMyOrganizationUnitsRoute from "@/contexts/company/interface/routes/company.my-organization-units"

export const GET = voidApiRoute(
  "GET",
  "/company/my-organization-units",
  companyMyOrganizationUnitsRoute.GET,
)
