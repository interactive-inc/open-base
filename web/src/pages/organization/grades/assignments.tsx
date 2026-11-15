import { UserSearchIcon } from "lucide-react"
import { useState, type ComponentProps } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from "@/components/ui/timeline"
import { EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useCompanyJson } from "@/components/app/organization-api"
import { EmployeeLookup } from "@/components/app/organization-employee-lookup"
import { ChangeMark, PeriodBadge } from "@/components/app/organization-period"
import {
  formatCalendarDate,
  formatPeriod,
  formatRecordedAt,
  periodStatus,
  todayOnCompanyCalendar,
  type CompanyResource,
  type CompanyResourceList,
  type GradeAssignmentAttributes,
  type GradeAssignmentHistory,
  type GradeAttributes,
  type GradeAwardArchive,
  type PeriodStatus,
  type ReportingNode,
} from "@/components/app/organization-types"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./assignments.server"

type AssignmentsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }
type Assignment = CompanyResource<GradeAssignmentAttributes>

/** 割当の期間を、時系列の位置（済み・いまここ・これから）に読み替える。 */
const PLACE: Readonly<
  Record<PeriodStatus, NonNullable<ComponentProps<typeof TimelineItem>["status"]>>
> = {
  ended: "complete",
  current: "current",
  scheduled: "upcoming",
}

/** 従業員への等級の割当。今の等級、割当の推移、記録の履歴を見せる。 */
export default function GradeAssignments(props: AssignmentsProps) {
  const { organizationId } = props
  const [employeeCode, setEmployeeCode] = useState(props.employeeCode)

  return (
    <>
      <PageHeader title="等級の割当" description="従業員ごとの等級と、その移り変わりです。" />
      <section aria-labelledby="grade-employee">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="grade-employee">従業員</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmployeeLookup
              value={employeeCode}
              description="番号は従業員の画面や組織図で確かめられます。"
              onSubmit={setEmployeeCode}
            />
          </CardContent>
        </Card>
      </section>
      {employeeCode === null ? (
        <EmptyState
          icon={UserSearchIcon}
          title="従業員を選んでください"
          description="従業員番号を入れると、その人の等級と履歴を表示します。"
        />
      ) : (
        <EmployeeGrades
          key={employeeCode}
          employeeCode={employeeCode}
          organizationId={organizationId}
        />
      )}
    </>
  )
}

function EmployeeGrades(props: { employeeCode: string; organizationId: string }) {
  const reporting = useApiJson<ReportingNode[]>(
    `/company/reporting-lines/${encodeURIComponent(props.employeeCode)}`,
  )
  return (
    <Loaded state={reporting} fallback={<RowsSkeleton rows={2} />}>
      {(nodes) => {
        const person = nodes.find((node) => node.depth === 0)
        return person === undefined ? (
          <Alert role="status">
            <AlertDescription>この番号の従業員は見つかりませんでした。</AlertDescription>
          </Alert>
        ) : (
          <PersonGrades person={person} organizationId={props.organizationId} />
        )
      }}
    </Loaded>
  )
}

function PersonGrades(props: { person: ReportingNode; organizationId: string }) {
  const { person } = props
  const today = todayOnCompanyCalendar()
  const snapshot = useCompanyJson<CompanyResourceList>(
    "/company/organization-snapshots",
    props.organizationId,
  )
  const grades = useCompanyJson<CompanyResourceList>(
    "/company/definitions?type=grade",
    props.organizationId,
  )
  const gradeById = new Map(
    grades.kind === "ok"
      ? (grades.data.resources as CompanyResource<GradeAttributes>[]).map((grade) => [
          grade.id,
          grade.attributes,
        ])
      : [],
  )
  const gradeName = (id: string) => {
    const grade = gradeById.get(id)
    return grade === undefined ? id : `${grade.officialName}（${grade.code}）`
  }
  const personDetail = [person.employee_code ?? "番号なし", person.department_code, person.position]
    .filter((part) => part !== null)
    .join(" · ")

  return (
    <>
      <Loaded state={snapshot} fallback={<RowsSkeleton rows={2} />}>
        {(data) => {
          const assignments = (
            data.resources.filter(
              (item) =>
                item.type === "grade-assignment" &&
                (item.attributes as GradeAssignmentAttributes).employeeId === person.employee_id,
            ) as Assignment[]
          ).toSorted((left, right) => left.effectiveFrom.localeCompare(right.effectiveFrom))
          const current = assignments.find(
            (item) => periodStatus(item.effectiveFrom, item.effectiveTo, today) === "current",
          )
          return (
            <>
              <section aria-labelledby="grade-now">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h2 id="grade-now">今の等級</h2>
                    </CardTitle>
                    <CardDescription>
                      <span className="font-medium text-foreground">{person.employee_name}</span>
                      {` · ${personDetail}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1">
                    <p className="text-lg font-semibold">
                      {current === undefined
                        ? "割り当てられていません"
                        : gradeName(current.attributes.gradeId)}
                    </p>
                    {current !== undefined && (
                      <p className="text-muted-foreground">
                        {formatPeriod(current.effectiveFrom, current.effectiveTo)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </section>

              <section aria-labelledby="grade-timeline">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      <h2 id="grade-timeline">割当の推移</h2>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {assignments.length === 0 ? (
                      <p>表示できる割当はありません。</p>
                    ) : (
                      <Timeline aria-label="等級の割当の推移">
                        {assignments.map((item) => {
                          const status = periodStatus(item.effectiveFrom, item.effectiveTo, today)
                          return (
                            <TimelineItem key={item.id} value={item.id} status={PLACE[status]}>
                              <TimelineMarker />
                              <TimelineConnector />
                              <TimelineTitle className="flex flex-wrap items-center gap-2">
                                {gradeName(item.attributes.gradeId)}
                                <PeriodBadge
                                  from={item.effectiveFrom}
                                  to={item.effectiveTo}
                                  on={today}
                                />
                              </TimelineTitle>
                              <TimelineTime dateTime={item.effectiveFrom}>
                                {formatPeriod(item.effectiveFrom, item.effectiveTo)}
                              </TimelineTime>
                              <TimelineDescription>版 {item.revision}</TimelineDescription>
                            </TimelineItem>
                          )
                        })}
                      </Timeline>
                    )}
                  </CardContent>
                </Card>
              </section>

              <RecordHistory
                key={data.organizationRevision}
                employeeId={person.employee_id}
                organizationId={props.organizationId}
                organizationRevision={data.organizationRevision}
                gradeName={gradeName}
              />
            </>
          )
        }}
      </Loaded>
      <Archive employeeId={person.employee_id} organizationId={props.organizationId} />
    </>
  )
}

/** 割当の記録をすべての版で見せる。新しい記録を上にし、何をした記録かを札で示す。 */
function RecordHistory(props: {
  employeeId: string
  organizationId: string
  organizationRevision: number
  gradeName: (id: string) => string
}) {
  const history = useCompanyJson<GradeAssignmentHistory>(
    `/company/grade-assignment-history?employee_id=${encodeURIComponent(props.employeeId)}&organization_revision=${props.organizationRevision}&limit=100`,
    props.organizationId,
  )

  return (
    <section aria-labelledby="grade-history">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="grade-history">記録の履歴</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loaded state={history} fallback={<RowsSkeleton rows={2} />}>
            {(page) =>
              page.revisions.length === 0 ? (
                <p>記録はまだありません。</p>
              ) : (
                <Timeline aria-label="等級の割当の記録">
                  {page.revisions
                    .map((entry) => ({
                      entry,
                      previous: page.revisions.find(
                        (other) => other.id === entry.id && other.revision === entry.revision - 1,
                      ),
                    }))
                    .reverse()
                    .map(({ entry, previous }) => (
                      <TimelineItem key={`${entry.id}-${entry.revision}`}>
                        <TimelineMarker />
                        <TimelineConnector />
                        <TimelineTitle className="flex flex-wrap items-center gap-2">
                          {props.gradeName(entry.gradeId)}
                          {entry.state === "void" ? (
                            <ChangeMark>取消</ChangeMark>
                          ) : previous === undefined ? (
                            <Badge variant="secondary">新しい割当</Badge>
                          ) : previous.effectiveTo !== entry.effectiveTo ? (
                            <ChangeMark>期間を変更</ChangeMark>
                          ) : (
                            <ChangeMark>訂正</ChangeMark>
                          )}
                        </TimelineTitle>
                        <TimelineTime dateTime={new Date(entry.recordedAt).toISOString()}>
                          記録 {formatRecordedAt(entry.recordedAt)}
                        </TimelineTime>
                        <TimelineDescription className="flex flex-col gap-1">
                          <span>
                            {formatPeriod(entry.effectiveFrom, entry.effectiveTo)} · 割当の版{" "}
                            {entry.revision} · 会社の版 {entry.organizationRevision}
                          </span>
                          <span className="text-foreground">理由: {entry.reason}</span>
                        </TimelineDescription>
                      </TimelineItem>
                    ))}
                </Timeline>
              )
            }
          </Loaded>
        </CardContent>
      </Card>
    </section>
  )
}

/** 旧台帳から保全した付与記録。無い人がほとんどなので、あるときだけ出す。 */
function Archive(props: { employeeId: string; organizationId: string }) {
  const archive = useCompanyJson<GradeAwardArchive>(
    `/company/grade-award-archives/by-employee/${encodeURIComponent(props.employeeId)}`,
    props.organizationId,
  )
  if (archive.kind !== "ok") return null
  return (
    <section aria-labelledby="grade-archive">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="grade-archive">旧台帳から保全した付与記録</h2>
          </CardTitle>
          <CardDescription>
            保全 {formatRecordedAt(archive.data.recordedAt)} · 記録番号 {archive.data.commandId}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            {formatCalendarDate(archive.data.observedOn)}時点の記録 · 理由: {archive.data.reason}
          </p>
        </CardContent>
      </Card>
    </section>
  )
}
