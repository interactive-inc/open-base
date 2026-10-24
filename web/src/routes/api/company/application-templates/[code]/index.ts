// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyApplicationTemplatesCodeRoute from "@/api/routes/company.application-templates.$code"

export const GET = voidApiRoute(
  "GET",
  "/company/application-templates/:code",
  companyApplicationTemplatesCodeRoute.GET,
)
export const PUT = voidApiRoute(
  "PUT",
  "/company/application-templates/:code",
  companyApplicationTemplatesCodeRoute.PUT,
)
export const DELETE = voidApiRoute(
  "DELETE",
  "/company/application-templates/:code",
  companyApplicationTemplatesCodeRoute.DELETE,
)
