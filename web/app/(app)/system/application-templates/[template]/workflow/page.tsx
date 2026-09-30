import { notFound } from "next/navigation"
import { WorkflowEditor } from "@/app/(app)/system/application-templates/[template]/workflow/_components/workflow-editor"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { getApplicationTemplate } from "@/lib/api/get-application-template"
import { getApplicationWorkflow } from "@/lib/api/get-application-workflow"
import type { ApplicationWorkflow } from "@/lib/api/types/application-workflow-types"

export const metadata = { title: "承認フロー設定" }

export default async function WorkflowPage(props: { params: Promise<{ template: string }> }) {
  const routeParams = await props.params
  const templateCode = routeParams.template
  const [template, result] = await Promise.all([
    getApplicationTemplate(templateCode),
    getApplicationWorkflow(templateCode),
  ])
  if (template instanceof Error || result instanceof Error) notFound()
  const initial: ApplicationWorkflow = result.workflow ?? {
    version: 1,
    steps: [
      {
        key: "manager_approval",
        name: "上長承認",
        approvers: [{ type: "direct_manager" }],
        approval_mode: "any",
        condition_mode: "all",
        conditions: [],
        due_days: null,
        escalation_approvers: [],
        rejection_behavior: "return",
        allow_delegation: true,
      },
    ],
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={`${template.name}の承認フロー`}>
        <BackButton
          href={`/system/application-templates/${templateCode}`}
          label="テンプレートへ戻る"
        />
      </PageHeader>
      <WorkflowEditor code={templateCode} initial={initial} revision={result.revision ?? 0} />
    </div>
  )
}
