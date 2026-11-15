import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import { readReviewCycle, readReviewSheets } from "@/api/http/reviews-page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import { isReviewId, reviewApi } from "@/components/app/reviews-paths"
import type { ReviewCycleDetail, ReviewPage, ReviewSheet } from "@/components/app/reviews-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const id = c.req.param("id") ?? ""
  const valid = isReviewId(id)
  const user = getUser()
  if (user === null) {
    return c.redirect(
      `/sign-in?next=${encodeURIComponent(valid ? `/reviews/cycles/${id}` : "/reviews/cycles")}`,
    )
  }
  const forbidden = { kind: "forbidden" } as const
  const [profile, cycle, mine, all] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    valid ? readReviewCycle<ReviewCycleDetail>(c, reviewApi.cycle(id)) : forbidden,
    valid ? readReviewSheets<ReviewPage<ReviewSheet>>(c, reviewApi.mySheets(id)) : forbidden,
    // 全員のシートは全社の閲覧権限がある人だけが読める。読めなければ集計を出さない。
    valid ? readReviewSheets<ReviewPage<ReviewSheet>>(c, reviewApi.allSheets(id)) : forbidden,
  ])
  return { email: user.email, pathname: "/reviews", id, initial: { profile, cycle, mine, all } }
})

export const head = defineHead(() => ({
  title: "評価期間",
  bodyAttrs: { "data-shell": "app" },
}))
