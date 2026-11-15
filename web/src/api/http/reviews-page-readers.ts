import { pageApiReader } from "@/api/http/void-api-route"
import * as cycleRoute from "@/contexts/performance-review/interface/routes/performance-review.cycles.$id"
import * as cyclesRoute from "@/contexts/performance-review/interface/routes/performance-review.cycles"
import * as sheetHistoryRoute from "@/contexts/performance-review/interface/routes/performance-review.sheets.$id.history"
import * as sheetRoute from "@/contexts/performance-review/interface/routes/performance-review.sheets.$id"
import * as sheetsRoute from "@/contexts/performance-review/interface/routes/performance-review.sheets"

/**
 * 評価の画面のloaderが最初の表示のために読むAPI。
 * 型は画面の側が決める。ここは経路とhandlerの対応だけを持つ。
 */
export const readReviewCycles = pageApiReader("/performance-review/cycles", cyclesRoute.GET)

export const readReviewCycle = pageApiReader("/performance-review/cycles/:id", cycleRoute.GET)

export const readReviewSheets = pageApiReader("/performance-review/sheets", sheetsRoute.GET)

export const readReviewSheet = pageApiReader("/performance-review/sheets/:id", sheetRoute.GET)

export const readReviewSheetHistory = pageApiReader(
  "/performance-review/sheets/:id/history",
  sheetHistoryRoute.GET,
)
