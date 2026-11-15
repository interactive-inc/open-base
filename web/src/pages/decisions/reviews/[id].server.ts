import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import {
  readReviewCycle,
  readReviewSheet,
  readReviewSheetHistory,
  readReviewSheets,
} from "@/api/http/reviews-page-readers"
import { isReviewId, reviewApi } from "@/components/app/reviews-paths"
import type {
  ReviewCycleDetail,
  ReviewHistoryEntry,
  ReviewInboxSheet,
  ReviewPage,
  ReviewSheetDetail,
} from "@/components/app/reviews-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  const valid = isReviewId(id)
  const user = getUser()
  if (user === null) {
    return c.redirect(
      `/sign-in?next=${encodeURIComponent(valid ? `/decisions/reviews/${id}` : "/reviews")}`,
    )
  }
  const forbidden = { kind: "forbidden" } as const
  const [sheet, history] = await Promise.all([
    valid ? readReviewSheet<ReviewSheetDetail>(c, reviewApi.sheet(id)) : forbidden,
    valid
      ? readReviewSheetHistory<ReviewPage<ReviewHistoryEntry>>(c, reviewApi.history(id))
      : forbidden,
  ])
  // 期間の名前と承認経路、いま判断できるシートかを、シートの評価期間で絞って読む。
  const cycleId = sheet.kind === "ok" ? sheet.data.cycle_id : null
  const [cycle, inbox] =
    cycleId === null
      ? [null, null]
      : await Promise.all([
          readReviewCycle<ReviewCycleDetail>(c, reviewApi.cycle(cycleId)),
          readReviewSheets<ReviewPage<ReviewInboxSheet>>(c, reviewApi.inbox(cycleId)),
        ])
  return { id, initial: { sheet, history, cycle, inbox } }
})

export const head = defineHead(() => ({ title: "評価の判断" }))
