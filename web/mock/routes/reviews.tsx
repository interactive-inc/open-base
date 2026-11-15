import ReviewDecision from "@/pages/decisions/reviews/[id]"
import Reviews from "@/pages/reviews/index"
import ReviewCycle from "@/pages/reviews/cycles/[id]"
import ReviewCycles from "@/pages/reviews/cycles/index"
import ReviewSheet from "@/pages/reviews/sheets/[id]"
import type { MockRoute } from "./route"

/** 評価の画面と、評価者の判断の画面。経路はVoidの `pages/reviews` と `pages/decisions/reviews` と同じにする。 */
export const route: MockRoute = ({ path, email }) => {
  if (path.startsWith("/decisions/reviews/")) {
    const segments = path.split("/").filter(Boolean)
    return segments.length === 3 ? <ReviewDecision id={segments[2] ?? ""} /> : null
  }
  if (path !== "/reviews" && !path.startsWith("/reviews/")) return null
  const props = { email, pathname: "/reviews" }
  const segments = path.split("/").filter(Boolean)
  if (segments.length === 1) return <Reviews {...props} />
  if (path === "/reviews/cycles") return <ReviewCycles {...props} />
  if (segments[1] === "cycles" && segments.length === 3)
    return <ReviewCycle {...props} id={segments[2] ?? ""} />
  if (segments[1] === "sheets" && segments.length === 3)
    return <ReviewSheet {...props} id={segments[2] ?? ""} />
  return null
}
