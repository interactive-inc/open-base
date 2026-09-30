import { FetchError } from "@/components/fetch-error"
import { EmployeeCreateForm } from "@/app/(app)/company/employees/_components/employee-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { getPersonnelPositionSnapshot } from "@/lib/api/get-personnel-position-snapshot"
import { canCreateEmployee } from "@/lib/employee/can-create-employee"
import { notFound } from "next/navigation"

export const metadata = { title: "従業員登録" }

/** 従業員登録画面。フォームは Client Component に切り出し、Server Action で POST /employees する。 */
export default async function EmployeeNewPage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canCreateEmployee(currentUser.permissions) === false) {
    notFound()
  }

  const canAssignRole = currentUser.permissions.includes("employee:assign_role")

  const snapshot = await getPersonnelPositionSnapshot()

  if (snapshot instanceof Error) return <FetchError message="会社情報の取得に失敗しました" />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="従業員を登録">
        <BackButton href="/company/employees" label="一覧に戻る" />
      </PageHeader>

      <Card className="gap-0">
        <div className="p-8">
          <EmployeeCreateForm
            canAssignRole={canAssignRole}
            companyRevision={snapshot.companyRevision}
          />
        </div>
      </Card>
    </div>
  )
}
