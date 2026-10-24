// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemPreservedRecordsRecordIdDossierRoute from "@system/interface/routes/system.preserved-records.$recordId.dossier"

export const GET = voidApiRoute(
  "GET",
  "/system/preserved-records/:recordId/dossier",
  systemPreservedRecordsRecordIdDossierRoute.GET,
)
