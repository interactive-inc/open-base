import { zEmployeeId } from "@/contexts/company/domain/definitions/workforce-id-validation.definition"
import { z } from "zod"

/** 従業員ごとの時間外の参考集計。1 日 8 時間×営業日を超えた分の合計（法定判定ではない参考値）。 */
export const zAppOvertimeSummaryEntry = z.object({
  employee_id: zEmployeeId,
  work_days: z.number(),
  total_work_minutes: z.number(),
  overtime_minutes: z.number(),
})

/** 月内の時間外の集計表示のレスポンス。note は「法定判定ではない参考集計」である旨の説明。 */
export const zAppOvertimeSummary = z.object({
  month: z.string(),
  business_days: z.number(),
  daily_regular_minutes: z.number(),
  entries: z.array(zAppOvertimeSummaryEntry),
  note: z.string(),
})
