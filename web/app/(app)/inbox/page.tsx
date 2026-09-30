import { FetchError } from "@/components/fetch-error"
import { getFeatureAvailability } from "@/lib/api/get-feature-availability"
import { CardLink } from "@/components/card-link"
import { EmptyState } from "@/components/empty-state"
import { CardDescription, CardTitle } from "@/components/ui/card"
import { getInboxCounts } from "@/lib/api/get-inbox-counts"
import { getMe } from "@/lib/api/get-me"
import { inboxCountFor } from "@/lib/inbox/inbox-count-for"
import { visibleInboxTypes } from "@/lib/inbox/visible-inbox-types"
import { Inbox } from "lucide-react"

export const metadata = { title: "受信箱" }

/**
 * 受信箱トップ。種類別の対応待ち件数カードを並べる。件数 API を持つ種類は件数を、
 * 持たない種類は導線カードとして表示する。件数を持つ種類がすべて 0 なら空状態を出す。
 */
export default async function InboxPage() {
  const [currentUser, countsResult, disabledFeatures] = await Promise.all([
    getMe(),
    getInboxCounts(),
    getFeatureAvailability(),
  ])

  if (disabledFeatures instanceof Error) {
    return <FetchError message={disabledFeatures.message} />
  }

  const permissions = currentUser instanceof Error ? [] : currentUser.permissions

  const counts =
    countsResult instanceof Error
      ? { applications: 0, expenses: 0, leaves: 0, shifts: 0, thanks: 0 }
      : countsResult

  const types = visibleInboxTypes(permissions, disabledFeatures)

  const cards = types.map((inboxType) => ({
    inboxType,
    count: inboxCountFor(inboxType, counts),
    hasMore:
      (inboxType.countKey === "expenses" && counts.expenses_has_more === true) ||
      (inboxType.countKey === "leaves" && counts.leaves_has_more === true),
  }))

  const totalPending = cards.reduce((sum, card) => sum + (card.count ?? 0), 0)

  const hasCountable = cards.some((card) => card.count !== null)

  return (
    <div className="flex flex-col gap-8">
      {hasCountable && totalPending === 0 && !cards.some((card) => card.hasMore) ? (
        <EmptyState
          icon={Inbox}
          title="対応待ちはありません"
          description="新しい申請や承認が届くとここに表示されます。"
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <CardLink
              key={card.inboxType.key}
              href={card.inboxType.href}
              className="flex min-h-24 flex-col justify-between gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{card.inboxType.label}</CardTitle>

                {card.count !== null ? (
                  <span className="text-2xl font-semibold tabular-nums">
                    {card.count}
                    {card.hasMore ? "+" : ""}
                  </span>
                ) : null}
              </div>

              <CardDescription>
                {card.hasMore
                  ? "受信箱を開いて続きを確認"
                  : card.count === null
                    ? "受信箱を開く"
                    : card.count === 0
                      ? "対応待ちはありません"
                      : `${card.count} 件の対応待ち`}
              </CardDescription>
            </CardLink>
          ))}
        </div>
      )}
    </div>
  )
}
