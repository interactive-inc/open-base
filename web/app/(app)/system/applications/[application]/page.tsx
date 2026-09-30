import { toEntityId } from "@/lib/form/to-entity-id"
import { CheckCircle2, Circle, Clock3, RotateCcw, XCircle } from "lucide-react"
import { notFound } from "next/navigation"
import { formatDateTime } from "@/lib/format-date-time"
import { ApplicationStatusBadge } from "@/components/application-status-badge"
import { BackButton } from "@/components/back-button"
import { DetailField } from "@/components/detail-field"
import { PageHeader } from "@/components/page-header"
import { ApplicationDecisionForm } from "@/app/(app)/system/applications/[application]/_components/application-decision-form"
import { Card } from "@/components/ui/card"
import { getApplicationDetail } from "@/lib/api/get-application-detail"
import { handleDetailError } from "@/lib/api/handle-detail-error"
import type { ApplicationApprovalEntry } from "@/lib/api/types/application-types"
import type { ApplicationWorkflowProgress } from "@/lib/api/types/application-types"

export const metadata = { title: "申請詳細" }

type Props = {
  params: Promise<{ application: string }>
}

/** 申請詳細画面。RSC で 1 件取得し、ステータスと payload を表示する。 */
export default async function ApplicationDetailPage(props: Props) {
  const params = await props.params

  const applicationId = toEntityId(params.application)

  if (applicationId === null) {
    notFound()
  }

  const application = await getApplicationDetail(applicationId)

  if (application instanceof Error) {
    handleDetailError(application)
  }
  const decisionStep = application.workflow?.steps.find(
    (step) => step.key === application.decision_target.task_key,
  )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={application.template_name}>
        <BackButton href="/my/applications" label="一覧に戻る" />
      </PageHeader>

      <ApplicationStatusBadge
        status={application.status}
        returned={application.workflow?.returned === true}
      />

      <Card className="gap-0">
        <dl className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
          <DetailField label="申請者">{application.applicant_name}</DetailField>

          <DetailField label="テンプレートコード">{application.template_code}</DetailField>

          <DetailField label="現在のステップ">{application.current_step ?? "-"}</DetailField>

          <DetailField label="申請日">{formatDateTime(application.created_at)}</DetailField>
        </dl>
      </Card>

      <Card className="gap-0">
        <div className="flex flex-col gap-2 p-4">
          <span className="text-sm font-medium">申請内容</span>

          <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
            {JSON.stringify(application.payload, null, 2)}
          </pre>
        </div>
      </Card>

      {application.can_decide && decisionStep !== undefined ? (
        <section aria-label="申請の判断" className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">この内容を確認して判断する</h2>
          <ApplicationDecisionForm
            key={`${application.id}:${application.decision_target.proposal_version}:${application.decision_target.task_key}:${application.decision_target.task_round}`}
            applicationId={application.id}
            decisionTarget={application.decision_target}
            negativeAction={decisionStep.rejection_behavior}
          />
        </section>
      ) : null}

      <ApprovalHistory approvals={application.approvals} />

      {application.workflow === null ? null : <WorkflowProgress workflow={application.workflow} />}
    </div>
  )
}

function WorkflowProgress(props: { workflow: ApplicationWorkflowProgress }) {
  return (
    <Card className="gap-0">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">承認フロー</span>
          <span className="text-xs text-muted-foreground">
            ラウンド {props.workflow.current_round}
            {props.workflow.due_at === null
              ? ""
              : `・期限 ${formatDateTime(props.workflow.due_at)}`}
          </span>
        </div>
        <ol className="grid gap-4 md:grid-cols-2">
          {props.workflow.steps.map((step, index) => {
            const Icon =
              step.status === "approved"
                ? CheckCircle2
                : step.status === "returned"
                  ? RotateCcw
                  : step.status === "rejected"
                    ? XCircle
                    : step.status === "pending"
                      ? Clock3
                      : Circle
            return (
              <li key={step.key} className="flex items-center gap-4 rounded-lg bg-card border p-4">
                <Icon className="size-4 shrink-0" aria-hidden />
                <div>
                  <div className="text-xs text-muted-foreground">ステップ {index + 1}</div>
                  <div className="text-sm font-medium">{step.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {workflowStatusLabel(step.status)}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
        {props.workflow.approvals.length === 0 ? null : (
          <ol className="flex flex-col gap-2 border-t pt-4">
            {props.workflow.approvals.map((approval) => (
              <li key={approval.id} className="text-sm">
                <span className="font-medium">{approval.approver_name}</span>
                {approval.approver_name === approval.represented_approver_name ? null : (
                  <span className="text-muted-foreground">
                    （{approval.represented_approver_name} の代理）
                  </span>
                )}
                <span className="text-muted-foreground">
                  {" "}
                  が{" "}
                  {approval.action === "approve"
                    ? "承認"
                    : approval.action === "return"
                      ? "差戻し"
                      : "却下"}
                  ・ラウンド {approval.round}・{formatDateTime(approval.created_at)}
                </span>
                {approval.comment === null ? null : (
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                    {approval.comment}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </Card>
  )
}

function workflowStatusLabel(status: ApplicationWorkflowProgress["steps"][number]["status"]) {
  return {
    waiting: "待機中",
    pending: "承認待ち",
    approved: "承認済み",
    rejected: "却下",
    returned: "差戻し",
  }[status]
}

/** 申請への承認/却下アクションの履歴。古い順に並べる。 */
function ApprovalHistory(props: { approvals: ReadonlyArray<ApplicationApprovalEntry> }) {
  if (props.approvals.length === 0) {
    return null
  }

  return (
    <Card className="gap-0">
      <div className="flex flex-col gap-4 p-4">
        <span className="text-sm font-medium">承認履歴</span>

        <ol className="flex flex-col gap-4">
          {props.approvals.map((approval) => {
            const Icon = approval.action === "approve" ? CheckCircle2 : XCircle

            const colorClass =
              approval.action === "approve" ? "text-emerald-600" : "text-destructive"

            const label = approval.action === "approve" ? "承認" : "却下"

            return (
              <li
                key={approval.id}
                className="flex items-start gap-4 rounded-md border bg-muted/30 p-4"
              >
                <Icon className={`mt-2 size-4 shrink-0 ${colorClass}`} aria-hidden />

                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-medium">{approval.approver_name}</span>

                    <span className={`text-xs ${colorClass}`}>が{label}</span>

                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(approval.created_at)}
                    </span>
                  </div>

                  {approval.comment !== null && approval.comment !== "" ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {approval.comment}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </Card>
  )
}
