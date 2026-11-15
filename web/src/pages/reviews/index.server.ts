import { defineHandler, defineHead, type InferProps } from "void"
import { getUser } from "void/auth"
import { readCurrentProfile } from "@/api/http/page-readers"
import { readReviewCycles, readReviewSheets } from "@/api/http/reviews-page-readers"
import type { CurrentProfile } from "@/components/app/app-shell"
import { reviewApi } from "@/components/app/reviews-paths"
import type {
  ReviewCycle,
  ReviewInboxSheet,
  ReviewPage,
  ReviewSheet,
} from "@/components/app/reviews-types"

/** サーバーではコンポーネントを描かず、ブラウザーで組み立てる。loaderは最初の要求でも実行される。 */
export const ssr = false

export type Props = Exclude<InferProps<typeof loader>, Response>

export const loader = defineHandler(async (c) => {
  const user = getUser()
  if (user === null) return c.redirect("/sign-in?next=%2Freviews")
  const [profile, cycles, mine, inbox] = await Promise.all([
    readCurrentProfile<CurrentProfile>(c),
    readReviewCycles<ReviewPage<ReviewCycle>>(c, reviewApi.cycles),
    readReviewSheets<ReviewPage<ReviewSheet>>(c, reviewApi.mySheets()),
    readReviewSheets<ReviewPage<ReviewInboxSheet>>(c, reviewApi.inbox()),
  ])
  return { email: user.email, pathname: "/reviews", initial: { profile, cycles, mine, inbox } }
})

export const head = defineHead(() => ({
  title: "評価",
  bodyAttrs: { "data-shell": "app" },
}))
