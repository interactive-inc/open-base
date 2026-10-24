// このファイルは `bun run gen:app` が生成する。手で編集しない。
// Voidの `/api` 配下の経路として、context routeのhandlerを共通middleware付きで公開する。

import { voidApiRoute } from "@/api/http/void-api-route"
import * as systemBatchJobsRoute from "@system/interface/routes/system.batch-jobs"

export const GET = voidApiRoute("GET", "/system/batch-jobs", systemBatchJobsRoute.GET)
