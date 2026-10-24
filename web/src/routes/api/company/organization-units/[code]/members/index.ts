// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyOrganizationUnitsCodeMembersRoute from "@/contexts/company/interface/routes/company.organization-units.$code.members"

export const GET = voidApiRoute(
  "GET",
  "/company/organization-units/:code/members",
  companyOrganizationUnitsCodeMembersRoute.GET,
)
