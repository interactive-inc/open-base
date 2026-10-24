// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyApplicationTemplatesRoute from "@/api/routes/company.application-templates"

export const GET = voidApiRoute(
  "GET",
  "/company/application-templates",
  companyApplicationTemplatesRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/company/application-templates",
  companyApplicationTemplatesRoute.POST,
)
