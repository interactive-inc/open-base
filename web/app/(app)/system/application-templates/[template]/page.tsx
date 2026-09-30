import { notFound } from "next/navigation"
import { SubmitApplicationForm } from "@/app/(app)/system/application-templates/[template]/_components/submit-application-form"
import { TemplateManagement } from "@/app/(app)/system/application-templates/_components/template-management"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { StatusLabel } from "@/components/status-label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { getApplicationTemplate } from "@/lib/api/get-application-template"
import { getMe } from "@/lib/api/get-me"
import { canManageApplicationTemplates } from "@/lib/application/can-manage-application-templates"
import { toFormSchema } from "@/lib/application/form-schema"
import { categoryLabel } from "@/lib/category-label"

export const metadata = { title: "申請テンプレート詳細" }

type Props = {
  params: Promise<{ template: string }>
}

/**
 * 申請テンプレ詳細 + 提出フォーム画面。RSC でテンプレを取得し、保存済みスキーマを動的フォームへ渡す。
 */
export default async function ApplicationTemplateDetailPage(props: Props) {
  const params = await props.params

  const template = await getApplicationTemplate(params.template)

  if (template instanceof Error) {
    notFound()
  }

  const currentUser = await getMe()

  const canManage =
    currentUser instanceof Error ? false : canManageApplicationTemplates(currentUser.permissions)

  const schema = toFormSchema(template.schema_json)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={template.name}>
        <BackButton href="/system/application-templates" label="テンプレ一覧へ" />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <StatusLabel>{categoryLabel(template.category)}</StatusLabel>

        {canManage ? <TemplateManagement template={template} /> : null}
      </div>

      <Card>
        <CardHeader>
          <CardDescription>この依頼を提出する</CardDescription>
        </CardHeader>

        <CardContent>
          <SubmitApplicationForm templateCode={template.code} schema={schema} />
        </CardContent>
      </Card>
    </div>
  )
}
