import { GavelIcon } from "lucide-react"
import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import type { ApplicationDetail, Template } from "@/components/app/application-types"
import { DecisionHistory } from "@/components/app/applications-decision-history"
import { PayloadList, toPayloadLabels } from "@/components/app/applications-payload-list"
import { ReturnedLabel } from "@/components/app/applications-returned-label"
import { BackLink, formatDate, Loaded, PageHeader } from "@/components/app/data-view"
import { ApplicationStatusLabel, PhaseBar } from "@/components/app/phase-bar"
import { useApiJson } from "@/components/app/use-api-json"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 申請の一件。進み具合と内容を見せ、判断する番の人には判断の画面への入口を出す。 */
export default function ApplicationDetailPage({ email, pathname, id, initial }: DetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const application = useApiJson<ApplicationDetail>(
    `/company/application-requests/${id}`,
    initial?.application,
  )

  return (
    <>
      <BackLink href="/applications">申請の一覧</BackLink>

      <Loaded state={application} fallback={<Skeleton className="h-64 w-full" />}>
        {(detail) => <Detail detail={detail} templateState={initial?.template ?? undefined} />}
      </Loaded>
    </>
  )
}

function Detail(props: {
  detail: ApplicationDetail
  templateState: NonNullable<Props["initial"]>["template"] | undefined
}) {
  const { detail } = props
  const template = useApiJson<Template>(
    `/company/application-templates/${encodeURIComponent(detail.template_code)}`,
    props.templateState ?? undefined,
  )

  return (
    <>
      <PageHeader
        title={detail.template_name}
        description={`${detail.applicant_name || "申請者不明"} · ${formatDate(detail.created_at)} · 申請番号 ${detail.id}`}
        badges={
          <>
            {detail.workflow?.returned === true && <ReturnedLabel />}
            <ApplicationStatusLabel status={detail.status} />
          </>
        }
      />

      {/* 判断は専用の画面で行う。ここでは判断する番の人に入口だけを出す。 */}
      {detail.can_decide && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>あなたの判断を待っています</h2>
            </CardTitle>
            <CardDescription>内容を確かめて、承認か却下を記録してください。</CardDescription>
            <CardAction>
              <Button render={<Link href={`/decisions/applications/${detail.id}`} />}>
                <GavelIcon data-icon="inline-start" aria-hidden="true" />
                判断する
              </Button>
            </CardAction>
          </CardHeader>
        </Card>
      )}

      {detail.workflow !== null && detail.workflow.steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>進み具合</h2>
            </CardTitle>
            {detail.workflow.due_at !== null && detail.status === "pending" && (
              <CardDescription>期限 {formatDate(detail.workflow.due_at)}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <PhaseBar phases={detail.workflow.steps} label="承認の段階" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>申請の内容</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PayloadList payload={detail.payload} labels={toPayloadLabels(template)} />
        </CardContent>
      </Card>

      {detail.workflow !== null && detail.workflow.approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>これまでの判断</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DecisionHistory approvals={detail.workflow.approvals} />
          </CardContent>
        </Card>
      )}
    </>
  )
}
