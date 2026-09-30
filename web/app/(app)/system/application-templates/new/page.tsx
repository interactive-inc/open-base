import { notFound } from "next/navigation"
import { CreateTemplateForm } from "@/app/(app)/system/application-templates/_components/create-template-form"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getMe } from "@/lib/api/get-me"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"

export const metadata = { title: "申請テンプレートを作成" }

export default async function NewApplicationTemplatePage() {
  const currentUser = await getMe()

  if (
    currentUser instanceof Error ||
    canManageApplicationTemplates(currentUser.permissions) === false
  ) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="申請テンプレートを作成">
        <BackButton href="/system/application-templates" label="一覧に戻る" />
      </PageHeader>

      <Card>
        <CardContent>
          <CreateTemplateForm />
        </CardContent>
      </Card>
    </div>
  )
}
