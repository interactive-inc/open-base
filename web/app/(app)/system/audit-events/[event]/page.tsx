import { notFound } from "next/navigation"
import { auditActionLabel } from "@/app/(app)/system/audit-events/_lib/audit-action-label"
import { auditClientLabel } from "@/app/(app)/system/audit-events/_lib/audit-client-label"
import { auditOutcomeLabel } from "@/app/(app)/system/audit-events/_lib/audit-outcome-label"
import { auditReasonLabel } from "@/app/(app)/system/audit-events/_lib/audit-reason-label"
import { auditTargetTypeLabel } from "@/app/(app)/system/audit-events/_lib/audit-target-type-label"
import { AuditJsonView } from "@/app/(app)/system/audit-events/_components/audit-json-view"
import { formatAuditDateTime } from "@/app/(app)/system/audit-events/_lib/format-audit-date-time"
import { BackButton } from "@/components/back-button"
import { PageHeader } from "@/components/page-header"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { StatusLabel } from "@/components/status-label"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ApiResponseError } from "@/lib/api/api-response-error"
import { AuthError } from "@/lib/api/auth-error"
import { getAuditEvent } from "@/lib/api/get-audit-event"
import type { AuditEventDetail } from "@/lib/api/types/audit-types"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "監査イベント" }

type Props = {
  params: Promise<{ event: string }>
}

const outcomeVariant = {
  succeeded: "secondary",
  denied: "secondary",
  failed: "destructive",
} as const

function actorLabel(event: AuditEventDetail): string {
  if (event.actor_account_id === null && event.actor_employee_id === null) return "未認証"
  return `account:${event.actor_account_id ?? "—"} / employee:${event.actor_employee_id ?? "—"}`
}

function DetailField(props: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className={
          props.mono ? "mt-2 break-all font-mono text-sm tabular-nums" : "mt-2 break-words text-sm"
        }
        translate={props.mono ? "no" : undefined}
      >
        {props.children}
      </dd>
    </div>
  )
}

function DetailError() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="監査イベント">
        <BackButton href="/system/audit-events" label="一覧に戻る" prefetch={false} />
      </PageHeader>
      <Alert variant="destructive">
        <AlertTitle>監査イベントを取得できませんでした</AlertTitle>
        <AlertDescription>時間をおいて、もう一度お試しください。</AlertDescription>
      </Alert>
    </div>
  )
}

export default async function AuditEventDetailPage(props: Props) {
  await requirePermission("audit:read")
  const routeParams = await props.params
  const eventId = routeParams.event
  const event = await getAuditEvent(eventId)

  if (event instanceof Error) {
    if (event instanceof ApiResponseError && event.status === 401) throw new AuthError()
    if (event instanceof ApiResponseError && (event.status === 403 || event.status === 404)) {
      notFound()
    }
    return <DetailError />
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="監査イベント">
        <BackButton href="/system/audit-events" label="一覧に戻る" prefetch={false} />
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="font-heading text-base font-medium">イベント概要</h2>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField label="イベントID" mono>
                {event.event_id}
              </DetailField>
              <DetailField label="リクエストID" mono>
                {event.request_id}
              </DetailField>
              <DetailField label="発生日時">
                <time dateTime={event.created_at} title={event.created_at} className="tabular-nums">
                  {formatAuditDateTime(event.created_at)}
                </time>
              </DetailField>
              <DetailField label="操作">{auditActionLabel(event.action)}</DetailField>
              <DetailField label="結果">
                <StatusLabel variant={outcomeVariant[event.outcome]}>
                  {auditOutcomeLabel(event.outcome)}
                </StatusLabel>
              </DetailField>
              <DetailField label="理由">{auditReasonLabel(event.reason_code)}</DetailField>
              <DetailField label="実行者" mono>
                {actorLabel(event)}
              </DetailField>
              <DetailField label="対象">
                {auditTargetTypeLabel(event.target_type)}
                {event.target_id === null ? null : (
                  <code className="block break-all text-xs text-muted-foreground" translate="no">
                    {event.target_id}
                  </code>
                )}
              </DetailField>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-heading text-base font-medium">リクエスト情報</h2>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField label="クライアント">{auditClientLabel(event.client_name)}</DetailField>
              <DetailField label="クライアントIP" mono>
                {event.client_ip ?? "—"}
              </DetailField>
            </dl>
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="forensic-json-heading" className="flex flex-col gap-4">
        <div>
          <h2 id="forensic-json-heading" className="text-lg font-semibold">
            証跡データ
          </h2>
          <p className="text-sm text-muted-foreground">
            必要な項目だけ展開し、取り扱いに注意してください。
          </p>
        </div>
        <AuditJsonView label="認可情報" value={event.authorization_json} />
        <AuditJsonView label="変更前" value={event.before_json} />
        <AuditJsonView label="変更後" value={event.after_json} />
        <AuditJsonView label="メタデータ" value={event.metadata_json} />
      </section>
    </div>
  )
}
