import { FetchError } from "@/components/fetch-error"
import { getFeatureAvailability } from "@/lib/api/get-feature-availability"
import { PageHeader } from "@/components/page-header"
import { PageTabs } from "@/components/page-tabs"
import { getInboxCounts } from "@/lib/api/get-inbox-counts"
import { getMe } from "@/lib/api/get-me"
import { inboxCountFor } from "@/lib/inbox/inbox-count-for"
import { visibleInboxTypes } from "@/lib/inbox/visible-inbox-types"

type Props = {
  children: React.ReactNode
}

/**
 * 受信箱の共通レイアウト。「受信箱」ヘッダと種類タブを全 /inbox/* ページで共有する。
 * permission の無い種類のタブは出さず、件数バッジは既存の /inbox/counts を使う。
 */
export default async function InboxLayout(props: Props) {
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

  const tabs = visibleInboxTypes(permissions, disabledFeatures).map((inboxType) => {
    const count = inboxCountFor(inboxType, counts)

    return {
      label: inboxType.label,
      href: inboxType.href,
      badge: count === null ? undefined : count,
      badgeSuffix:
        (inboxType.countKey === "expenses" && counts.expenses_has_more === true) ||
        (inboxType.countKey === "leaves" && counts.leaves_has_more === true)
          ? "+"
          : undefined,
    }
  })

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="受信箱" />

      <PageTabs tabs={tabs} />

      {props.children}
    </div>
  )
}
