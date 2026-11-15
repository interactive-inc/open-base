import type { CurrentProfile } from "@/components/app/app-shell"
import {
  readFormFields,
  type FormField,
  type TemplateDetail,
  type TemplateWorkflow,
} from "@/components/app/application-types"
import {
  describeApprovalMode,
  describeApprover,
  hasHiddenSettings,
  REJECTION_TEXT,
} from "@/components/app/applications-workflow"
import { BackLink, formatDate, Loaded, PageHeader } from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTitle,
} from "@/components/ui/timeline"
import type { Props } from "./[code].server"

type TemplateProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

const FIELD_TYPE_TEXT: Readonly<Record<FormField["type"], string>> = {
  text: "一行の文字",
  textarea: "複数行の文字",
  number: "数",
  date: "日付",
  select: "選択肢から選ぶ",
}

/** 申請テンプレートの一件。入力項目と承認ワークフローを見せる。変更はCLIかMCPで行う。 */
export default function ApplicationTemplate({ email, pathname, code, initial }: TemplateProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const path = `/company/application-templates/${encodeURIComponent(code)}`
  const template = useApiJson<TemplateDetail>(path, initial?.template)
  const workflow = useApiJson<TemplateWorkflow>(`${path}/workflow`, initial?.workflow)

  return (
    <>
      <BackLink href="/applications/templates">テンプレートの一覧</BackLink>

      <Loaded state={template} fallback={<Skeleton className="h-64 w-full" />}>
        {(data) => (
          <>
            <PageHeader
              title={data.name}
              description={
                data.description !== null && data.description !== "" ? (
                  <span className="whitespace-pre-wrap">{data.description}</span>
                ) : undefined
              }
              badges={
                <>
                  <Badge variant="secondary">{data.category}</Badge>
                  <Badge variant="outline" className="font-mono">
                    {data.code}
                  </Badge>
                </>
              }
            />

            <Fields fields={readFormFields(data.schema_json)} />

            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>承認ワークフロー</h2>
                </CardTitle>
                <CardDescription>
                  申請が進む段階と、それぞれで承認する人です。すでに出された申請には変更が効きません。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Loaded state={workflow} fallback={<Skeleton className="h-40 w-full" />}>
                  {(current) => <Workflow current={current} approverRoles={data.approver_roles} />}
                </Loaded>
              </CardContent>
            </Card>
          </>
        )}
      </Loaded>
    </>
  )
}

function Fields(props: { fields: ReadonlyArray<FormField> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>入力項目</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {props.fields.length === 0 ? (
          <p className="text-sm">入力項目はありません。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>項目</TableHead>
                <TableHead>種類</TableHead>
                <TableHead>キー</TableHead>
                <TableHead>必須</TableHead>
                <TableHead>選択肢</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.fields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className="font-medium">{field.label}</TableCell>
                  <TableCell>{FIELD_TYPE_TEXT[field.type]}</TableCell>
                  <TableCell className="font-mono">{field.id}</TableCell>
                  <TableCell>
                    {field.required ? <Badge variant="secondary">必須</Badge> : "任意"}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {field.type === "select" && field.options.length > 0
                      ? field.options.join("、")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function Workflow(props: { current: TemplateWorkflow; approverRoles: ReadonlyArray<string> }) {
  const { current } = props
  if (current.workflow === null || current.workflow.steps.length === 0) {
    return (
      <p className="text-sm">
        承認ワークフローはまだありません。
        {props.approverRoles.length > 0 &&
          `次の役割を持つ人が承認します：${props.approverRoles.join("、")}`}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {current.updated_at !== null && (
        <p className="text-xs text-muted-foreground">
          版 {current.revision} · {formatDate(current.updated_at)} に保存
        </p>
      )}
      <Timeline aria-label="承認の段階">
        {current.workflow.steps.map((step, index) => (
          <TimelineItem key={step.key} value={step.key}>
            <TimelineMarker />
            <TimelineConnector />
            <TimelineTitle>
              {index + 1}. {step.name}
            </TimelineTitle>
            <TimelineDescription className="flex flex-col gap-2 text-foreground">
              <span className="font-mono text-xs text-muted-foreground">{step.key}</span>
              {step.approvers.length > 0 && (
                <ul className="flex flex-col gap-1">
                  {step.approvers.map((approver, position) => (
                    <li key={position}>{describeApprover(approver)}</li>
                  ))}
                </ul>
              )}
              <span className="flex flex-wrap gap-2">
                <Badge variant="outline">{describeApprovalMode(step)}</Badge>
                <Badge variant="outline">
                  {step.due_days === null ? "期限なし" : `${step.due_days}日以内`}
                </Badge>
                <Badge variant="outline">{REJECTION_TEXT[step.rejection_behavior]}</Badge>
                <Badge variant="outline">
                  {step.allow_delegation ? "代理を認める" : "代理を認めない"}
                </Badge>
              </span>
              {hasHiddenSettings(step) && (
                <span>条件や引き継ぎ先の設定があります。詳しくはCLIかMCPで確かめてください。</span>
              )}
            </TimelineDescription>
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  )
}
