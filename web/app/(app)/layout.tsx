import { FetchError } from "@/components/fetch-error"
import { logoutAction } from "@/app/(app)/actions/logout"
import { AppShell } from "@/components/app-shell"
import { AuthProvider } from "@/components/auth-provider"
import { LoginPage } from "@/components/login-page"
import { isAuthError } from "@/lib/api/auth-error"
import { getMe } from "@/lib/api/get-me"
import { getFeatureAvailability } from "@/lib/api/get-feature-availability"
import { getInboxCounts } from "@/lib/api/get-inbox-counts"
import { getMyDepartments } from "@/lib/api/get-my-departments"
import { getOrgTree } from "@/lib/api/get-org-tree"
import { getMyUnreadCount } from "@/lib/api/get-my-unread-count"
import { getLocale } from "@/lib/i18n/get-locale"
import { flattenOrgTree } from "@/lib/org/flatten-org-tree"
import { unstable_rethrow } from "next/navigation"

type Props = {
  children: React.ReactNode
}

/**
 * 保護領域共通の layout。`getMe` で本人を取得し、未認証なら AppShell を描画せず
 * ログイン画面を正常応答として返す。
 * 取得した本人と未読件数を AppShell に渡し、AuthProvider 経由で配下からも参照できるようにする。
 */
export default async function AppLayout(props: Props) {
  let currentUser: Awaited<ReturnType<typeof getMe>>
  try {
    currentUser = await getMe()
  } catch (error) {
    unstable_rethrow(error)
    if (isAuthError(error)) {
      return <LoginPage />
    }
    throw error
  }

  // 未読数・受信箱件数バッジは補助情報なので、取得失敗時はページ描画を止めず 0 にフォールバックする
  // （意図的なグレースフルデグレード）。
  const [
    unreadCount,
    inboxCountsResult,
    locale,
    myDepartmentsResult,
    orgTreeResult,
    disabledFeatures,
  ] = await Promise.all([
    getMyUnreadCount(),
    getInboxCounts(),
    getLocale(),
    getMyDepartments(),
    getOrgTree(),
    getFeatureAvailability(),
  ])

  if (disabledFeatures instanceof Error) {
    return <FetchError message={disabledFeatures.message} />
  }

  const unreadNotificationCount = unreadCount instanceof Error ? 0 : unreadCount.count

  const inboxCounts =
    inboxCountsResult instanceof Error
      ? { applications: 0, expenses: 0, leaves: 0, shifts: 0, thanks: 0 }
      : inboxCountsResult

  const myDepartments = myDepartmentsResult instanceof Error ? [] : myDepartmentsResult

  const allDepartments = orgTreeResult instanceof Error ? [] : flattenOrgTree(orgTreeResult)

  return (
    <AuthProvider currentUser={currentUser}>
      <AppShell
        currentUser={currentUser}
        inboxCounts={inboxCounts}
        myDepartments={myDepartments}
        allDepartments={allDepartments}
        locale={locale}
        onLogout={logoutAction}
        unreadNotificationCount={unreadNotificationCount}
        disabledFeatures={disabledFeatures}
      >
        {props.children}
      </AppShell>
    </AuthProvider>
  )
}
