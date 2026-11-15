import { HistoryIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { BackLink, Loaded, PageHeader, TextSkeleton } from "@/components/app/data-view"
import { eventsPath, statePath } from "@/components/app/employees-detail-paths"
import { EmployeeStatusLabel } from "@/components/app/employees-status"
import { LifecycleTimeline } from "@/components/app/employees-timeline"
import {
  formatCalendarDate,
  todayInCompany,
  type EmployeeDetail,
  type LifecycleAssignment,
  type LifecycleEvent,
  type LifecycleEventPage,
  type LifecycleState,
} from "@/components/app/employees-types"
import { fetchApiJson, useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./[code].server"

type DetailProps = Omit<Props, "initial" | "asOf"> & {
  initial?: Props["initial"]
  asOf?: string | null
}

/** 従業員一人。基本の情報、基準日現在の所属と役職、これまでの人事発令を見せる。 */
export default function EmployeeDetailPage({ code, asOf, initial }: DetailProps) {
  const employee = useApiJson<EmployeeDetail>(
    `/company/employee-directory/${encodeURIComponent(code)}`,
    initial?.employee,
  )
  const today = todayInCompany()
  const firstDate = asOf ?? null
  const [date, setDate] = useState<string>(firstDate ?? today)

  return (
    <>
      <BackLink href="/employees">従業員の一覧</BackLink>

      <PageHeader
        title={
          employee.kind === "ok" ? (
            employee.data.name
          ) : employee.kind === "loading" ? (
            <TextSkeleton placeholder="従業員の名前" label="従業員を読み込んでいます" />
          ) : (
            "従業員"
          )
        }
        description="基準日現在の所属と役職、入社から今までの人事発令です。"
        badges={
          employee.kind === "ok" ? (
            <>
              <Badge variant="outline">{employee.data.code}</Badge>
              {employee.data.email !== "" && <Badge variant="outline">{employee.data.email}</Badge>}
              <EmployeeStatusLabel status={employee.data.status} />
            </>
          ) : undefined
        }
      />

      {employee.kind === "forbidden" || employee.kind === "error" ? (
        <Loaded state={employee}>{() => null}</Loaded>
      ) : (
        <>
          <StateSection
            key={date}
            code={code}
            date={date}
            today={today}
            initial={date === (firstDate ?? today) ? (initial?.state ?? undefined) : undefined}
            explicit={date !== today || firstDate !== null}
            onDate={setDate}
          />
          <HistorySection code={code} asOf={date} initial={initial?.events ?? undefined} />
        </>
      )}
    </>
  )
}

function StateSection(props: {
  code: string
  date: string
  today: string
  explicit: boolean
  initial: NonNullable<Props["initial"]>["state"] | undefined
  onDate: (date: string) => void
}) {
  const state = useApiJson<LifecycleState>(
    statePath(props.code, props.explicit ? props.date : null),
    props.initial,
  )

  return (
    <section aria-labelledby="state-heading">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="state-heading">
              {props.date === props.today ? "今の状態" : `${formatCalendarDate(props.date)}の状態`}
            </h2>
          </CardTitle>
          {props.date !== props.today && (
            <CardAction>
              <Button variant="secondary" onClick={() => props.onDate(props.today)}>
                今日に戻す
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field name="asOf" className="max-w-56">
            <FieldLabel>基準日</FieldLabel>
            <Input
              type="date"
              value={props.date}
              onValueChange={(value) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(value)) props.onDate(value)
              }}
            />
          </Field>
          <Loaded state={state} fallback={<Skeleton className="h-28 w-full" />}>
            {(data) => <StateView state={data} />}
          </Loaded>
        </CardContent>
      </Card>
    </section>
  )
}

function StateView({ state }: { state: LifecycleState }) {
  const assignments = [
    ...(state.primary_assignment === null ? [] : [state.primary_assignment]),
    ...state.concurrent_assignments,
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="flex flex-wrap items-center gap-2">
        在籍の状態
        <EmployeeStatusLabel status={state.status} />
      </p>
      {assignments.length === 0 ? (
        <p>この日の所属はありません。</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {assignments.map((assignment) => (
            <li key={assignment.period_id}>
              <AssignmentView assignment={assignment} />
            </li>
          ))}
        </ul>
      )}
      {state.responsibility_department_codes.length > 0 && (
        <p>責任者を務める部署: {state.responsibility_department_codes.join("、")}</p>
      )}
    </div>
  )
}

/** 所属一件。カードの中に置くので、カードを重ねずに一段沈んだ面で区切る。 */
function AssignmentView({ assignment }: { assignment: LifecycleAssignment }) {
  const primary = assignment.assignment_type === "primary"
  const managers =
    assignment.manager_employee_codes.length > 0
      ? assignment.manager_employee_codes
      : assignment.manager_employee_code === null
        ? []
        : [assignment.manager_employee_code]

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-muted p-4">
      <Badge variant={primary ? "secondary" : "outline"}>{primary ? "主所属" : "兼務"}</Badge>
      <span className="text-base font-medium">{assignment.department_name}</span>
      <dl className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1">
        <dt className="text-muted-foreground">役職</dt>
        <dd>{assignment.position_title ?? "なし"}</dd>
        <dt className="text-muted-foreground">上長</dt>
        <dd className="flex flex-wrap gap-2">
          {managers.length === 0
            ? "なし"
            : managers.map((manager) => (
                <Link key={manager} href={`/employees/${encodeURIComponent(manager)}`}>
                  {manager}
                </Link>
              ))}
        </dd>
        <dt className="text-muted-foreground">期間</dt>
        <dd>
          {formatCalendarDate(assignment.starts_on)}から
          {assignment.ends_on === null ? "" : ` ${formatCalendarDate(assignment.ends_on)}まで`}
        </dd>
      </dl>
    </div>
  )
}

function HistorySection(props: {
  code: string
  asOf: string
  initial: NonNullable<Props["initial"]>["events"] | undefined
}) {
  const first = useApiJson<LifecycleEventPage>(eventsPath(props.code, null), props.initial)
  const [more, setMore] = useState<{ events: LifecycleEvent[]; cursor: string | null } | null>(null)
  const [error, setError] = useState(false)

  async function loadMore(cursor: string) {
    setError(false)
    const page = await fetchApiJson<LifecycleEventPage>(eventsPath(props.code, cursor)).catch(
      () => ({ kind: "error" }) as const,
    )
    if (page.kind !== "ok") {
      setError(true)
      return
    }
    setMore((current) => ({
      events: [...(current?.events ?? []), ...page.data.data],
      cursor: page.data.next_cursor,
    }))
  }

  const events = first.kind === "ok" ? [...first.data.data, ...(more?.events ?? [])] : []
  const cursor = first.kind !== "ok" ? null : more === null ? first.data.next_cursor : more.cursor

  return (
    <section aria-labelledby="history-heading">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="history-heading">人事の履歴</h2>
          </CardTitle>
          {events.length > 0 && (
            <CardDescription>
              新しい順です。基準日現在の発令に「いまここ」を付けています。
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Loaded state={first} fallback={<Skeleton className="h-40 w-full" />}>
            {() =>
              events.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <HistoryIcon />
                    </EmptyMedia>
                    <EmptyTitle>まだ人事発令がありません</EmptyTitle>
                    <EmptyDescription>
                      CLI か MCP で発令すると、入社から今までの流れがここに並びます。
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <LifecycleTimeline events={events} asOf={props.asOf} label="人事発令の履歴" />
              )
            }
          </Loaded>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                続きを読み込めませんでした。もう一度押してください。
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        {cursor !== null && (
          <CardFooter className="justify-end">
            <Button variant="secondary" onClick={() => loadMore(cursor)}>
              さらに古い履歴を読む
            </Button>
          </CardFooter>
        )}
      </Card>
    </section>
  )
}
