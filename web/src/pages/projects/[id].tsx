import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { ProjectEfforts } from "@/components/app/business-efforts"
import { FeatureGate, isFeatureDisabled, useFeatures } from "@/components/app/business-feature"
import { employeeName, useEmployeeDirectory } from "@/components/app/business-directory"
import { RevisionHistory } from "@/components/app/business-history"
import { ProjectStage, ProjectStatusLabel } from "@/components/app/business-status"
import {
  formatMinutes,
  PROJECT_STATUS_TEXT,
  type CustomerRecord,
  type EmployeeDirectory,
  type OfferingRecord,
  type ProjectRecord,
  type RecordPage,
} from "@/components/app/business-types"
import { BackLink, formatDate, Loaded, PageHeader } from "@/components/app/data-view"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

type Initial = NonNullable<Props["initial"]>

const NOT_READ = { kind: "forbidden" } as const

/** 案件の一件。いまの段階、時間の予実、工数、変更の履歴を見せる。 */
export default function ProjectDetailPage({ email, pathname, id, initial }: DetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const features = useFeatures(initial?.features)

  return (
    <>
      <BackLink href="/projects">案件の一覧</BackLink>
      <FeatureGate
        features={features}
        feature="client-project"
        name="案件"
        fallback={<Skeleton className="h-64 w-full" />}
      >
        <ProjectBody
          id={id}
          initial={initial}
          customersEnabled={!isFeatureDisabled(features, "customer")}
          offeringsEnabled={!isFeatureDisabled(features, "offering")}
        />
      </FeatureGate>
    </>
  )
}

function ProjectBody(props: {
  id: string
  initial: Initial | undefined
  customersEnabled: boolean
  offeringsEnabled: boolean
}) {
  const project = useApiJson<RecordPage<ProjectRecord>>(
    `/client-project/records?kind=project&id=${props.id}`,
    props.initial?.project ?? undefined,
  )
  const customers = useApiJson<RecordPage<CustomerRecord>>(
    "/customer/records?limit=100",
    props.customersEnabled ? undefined : NOT_READ,
  )
  const offerings = useApiJson<RecordPage<OfferingRecord>>(
    "/offering/records?limit=100",
    props.offeringsEnabled ? undefined : NOT_READ,
  )
  const directory = useEmployeeDirectory()

  return (
    <Loaded state={project} fallback={<Skeleton className="h-64 w-full" />}>
      {(page) => {
        const record = page.data[0]
        if (record === undefined) {
          return (
            <Alert role="status">
              <AlertDescription>
                この案件は見つかりません。一覧から選び直してください。
              </AlertDescription>
            </Alert>
          )
        }
        return (
          <Project
            project={record}
            customers={customers}
            offerings={offerings}
            directory={directory}
          />
        )
      }}
    </Loaded>
  )
}

function Project(props: {
  project: ProjectRecord
  customers: ApiJsonState<RecordPage<CustomerRecord>>
  offerings: ApiJsonState<RecordPage<OfferingRecord>>
  directory: ApiJsonState<EmployeeDirectory>
}) {
  const { project } = props
  const customer =
    props.customers.kind === "ok"
      ? props.customers.data.data.find((item) => item.id === project.customer_id)
      : undefined
  const offering =
    project.offering_id !== null && props.offerings.kind === "ok"
      ? props.offerings.data.data.find((item) => item.id === project.offering_id)
      : undefined
  const period = [project.starts_on, project.due_on]
    .map((date) => (date === null ? "未定" : formatDate(date)))
    .join(" 〜 ")

  return (
    <>
      <PageHeader
        title={project.name}
        description={
          <>
            {customer === undefined ? (
              "顧客を確認できません"
            ) : (
              <Link href={`/customers/${customer.id}`} className="underline underline-offset-4">
                {customer.name}
              </Link>
            )}
            {offering !== undefined && ` · ${offering.name}`}
            {` · 担当 ${employeeName(props.directory, project.owner_employee_id)}`}
            {` · ${period}`}
          </>
        }
        badges={<ProjectStatusLabel status={project.status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>いまの段階</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectStage status={project.status} label="案件の段階" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>時間の予実</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-4 sm:grid-cols-3">
            <Fact term="予定" value={formatMinutes(project.planned_minutes)} />
            <Fact term="当初の予定" value={formatMinutes(project.baseline_minutes)} />
            <Fact term="実績" value={formatMinutes(project.actual_minutes)} />
            <Fact term="残りの見込み" value={formatMinutes(project.remaining_minutes)} />
            <Fact term="完了時の見込み" value={formatMinutes(project.forecast_minutes)} />
            <Fact
              term="予定との差"
              value={
                project.variance_minutes === null
                  ? "未入力"
                  : project.variance_minutes > 0
                    ? `${formatMinutes(project.variance_minutes)} 超える見込み`
                    : project.variance_minutes < 0
                      ? `${formatMinutes(-project.variance_minutes)} 余る見込み`
                      : "予定どおり"
              }
              alert={project.variance_minutes !== null && project.variance_minutes > 0}
            />
          </dl>
          {project.description !== "" && (
            <>
              <Separator />
              <p className="whitespace-pre-wrap">{project.description}</p>
            </>
          )}
        </CardContent>
      </Card>

      <ProjectEfforts
        projectId={project.id}
        employeeName={(id) => employeeName(props.directory, id)}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>変更の履歴</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectHistory id={project.id} />
        </CardContent>
      </Card>
    </>
  )
}

function Fact(props: { term: string; value: string; alert?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{props.term}</dt>
      <dd className={`tabular-nums ${props.alert === true ? "text-destructive" : ""}`}>
        {props.value}
      </dd>
    </div>
  )
}

function ProjectHistory({ id }: { id: string }) {
  const history = useApiJson<RecordPage<ProjectRecord>>(
    `/client-project/records?kind=project&id=${id}&history=true&limit=100`,
  )

  return (
    <Loaded state={history} fallback={<Skeleton className="h-16 w-full" />}>
      {(page) => (
        <RevisionHistory
          entries={page.data.map((item) => ({
            revision: item.revision,
            recorded_at: item.recorded_at,
            reason: item.reason,
            summary: `${PROJECT_STATUS_TEXT[item.status]} · ${item.name}`,
          }))}
        />
      )}
    </Loaded>
  )
}
