import { getGradeCreationContext } from "@/lib/api/get-grade-creation-context"
import { FetchError } from "@/components/fetch-error"
import { notFound } from "next/navigation"
import { GradeCreateForm } from "@/app/(app)/company/grades/_components/grade-create-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageGrades } from "@/lib/grade/can-manage-grades"

export const metadata = { title: "等級の作成" }

export default async function NewGradePage() {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canManageGrades(currentUser.permissions) === false) {
    notFound()
  }

  const snapshot = await getGradeCreationContext()
  if (snapshot instanceof Error)
    return <FetchError message="等級の作成に必要な情報を読み込めませんでした。" />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="等級の作成">
        <BackButton href="/company/grades" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <GradeCreateForm
            companyRevision={snapshot.companyRevision}
            commandId={snapshot.commandId}
            gradeId={snapshot.gradeId}
          />
        </CardContent>
      </Card>
    </div>
  )
}
