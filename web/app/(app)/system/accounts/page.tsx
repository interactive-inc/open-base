import { AccountListSection } from "@/app/(app)/system/accounts/_components/account-list-section"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { getMe } from "@/lib/api/get-me"
import { notFound } from "next/navigation"
import { Suspense } from "react"

export const metadata = { title: "アカウント" }

/**
 * System Account と割当ロール・状態を一覧する（iam:read が必要）。
 * 権限が無いユーザーには 404 を返し、管理機能の存在を露出しない。
 */
export default async function AdminAccountsPage() {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    (currentUser.permissions.includes("system:admin") === false &&
      currentUser.permissions.includes("iam:read") === false)
  ) {
    notFound()
  }

  const canWrite =
    currentUser.permissions.includes("system:admin") ||
    currentUser.permissions.includes("iam:write")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="アカウント" />

      <Suspense fallback={<ListSkeleton rows={5} rowClassName="h-10 w-full" />}>
        <AccountListSection canWrite={canWrite} actorPermissionKeys={currentUser.permissions} />
      </Suspense>
    </div>
  )
}
