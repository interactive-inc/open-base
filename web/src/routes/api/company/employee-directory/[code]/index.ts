// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyEmployeeDirectoryCodeRoute from "@/contexts/company/interface/routes/company.employee-directory.$code"

export const GET = voidApiRoute(
  "GET",
  "/company/employee-directory/:code",
  companyEmployeeDirectoryCodeRoute.GET,
)
export const PUT = voidApiRoute(
  "PUT",
  "/company/employee-directory/:code",
  companyEmployeeDirectoryCodeRoute.PUT,
)
