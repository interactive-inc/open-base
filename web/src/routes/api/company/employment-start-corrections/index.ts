// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyEmploymentStartCorrectionsRoute from "@/contexts/company/interface/routes/company.employment-start-corrections"

export const GET = voidApiRoute(
  "GET",
  "/company/employment-start-corrections",
  companyEmploymentStartCorrectionsRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/company/employment-start-corrections",
  companyEmploymentStartCorrectionsRoute.POST,
)
