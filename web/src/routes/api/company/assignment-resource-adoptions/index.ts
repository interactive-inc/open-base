// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyAssignmentResourceAdoptionsRoute from "@/contexts/company/interface/routes/company.assignment-resource-adoptions"

export const GET = voidApiRoute(
  "GET",
  "/company/assignment-resource-adoptions",
  companyAssignmentResourceAdoptionsRoute.GET,
)
export const POST = voidApiRoute(
  "POST",
  "/company/assignment-resource-adoptions",
  companyAssignmentResourceAdoptionsRoute.POST,
)
