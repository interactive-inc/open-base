import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import {
  readReviewCycle,
  readReviewSheet,
  readReviewSheetHistory,
  readReviewSheets,
} from "@/api/http/reviews-page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import { isReviewId, reviewApi } from "@/components/app/reviews-paths"
import type {
  ReviewCycleDetail,
  ReviewHistoryEntry,
  ReviewInboxSheet,
  ReviewPage,
  ReviewSheet,
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
      `/sign-in?next=${encodeURIComponent(valid ? `/reviews/sheets/${id}` : "/reviews")}`,
    )
  }
  const [profile, sheet, history] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid
      ? readReviewSheet<ReviewSheetDetail>(c, reviewApi.sheet(id))
      : Promise.resolve({ kind: "forbidden" } as const),
    valid
      ? readReviewSheetHistory<ReviewPage<ReviewHistoryEntry>>(c, reviewApi.history(id))
      : Promise.resolve({ kind: "forbidden" } as const),
  ])
  // 期間の承認経路と、見ている人が本人か評価者かを、シートの評価期間で絞って読む。
  const cycleId = sheet.kind === "ok" ? sheet.data.cycle_id : null
  const [cycle, mine, inbox] =
    cycleId === null
      ? [null, null, null]
      : await Promise.all([
          readReviewCycle<ReviewCycleDetail>(c, reviewApi.cycle(cycleId)),
          readReviewSheets<ReviewPage<ReviewSheet>>(c, reviewApi.mySheets(cycleId)),
          readReviewSheets<ReviewPage<ReviewInboxSheet>>(c, reviewApi.inbox(cycleId)),
        ])
  return {
    email: user.email,
    pathname: "/reviews",
    id,
    initial: { profile, sheet, history, cycle, mine, inbox },
  }
})

export const head = defineHead(() => ({
  title: "評価シート",
  bodyAttrs: { "data-shell": "app" },
}))
