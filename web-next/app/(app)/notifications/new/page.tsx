import { notFound } from "next/navigation"
import { NotificationCreateForm } from "@/app/(app)/notifications/_components/notification-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getEmployeeDirectory } from "@/lib/api/get-employee-directory"
import { getMe } from "@/lib/api/get-me"
import { canManageNotifications } from "@/lib/notifications/can-manage-notifications"

export const metadata = { title: "通知を作成" }

/**
 * 通知作成画面（特権ロールのみ）。作成後は /notifications へ redirect する。
 * 権限が無いユーザーには 404 を返し UI を露出しない。
 */
export default async function NotificationNewPage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageNotifications(currentUser.permissions) === false) {
    notFound()
  }

  const employeeResult = await getEmployeeDirectory()

  const employees =
    employeeResult instanceof Error
      ? []
      : employeeResult.items.flatMap((e) =>
          e.code === null ? [] : [{ code: e.code, name: e.name }],
        )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="通知を作成">
        <BackButton href="/notifications" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <NotificationCreateForm employees={employees} />
        </CardContent>
      </Card>
    </div>
  )
}
