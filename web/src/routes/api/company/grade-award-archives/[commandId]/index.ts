// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as companyGradeAwardArchivesCommandIdRoute from "@/contexts/company/interface/routes/company.grade-award-archives.$commandId"

export const GET = voidApiRoute(
  "GET",
  "/company/grade-award-archives/:commandId",
  companyGradeAwardArchivesCommandIdRoute.GET,
)
