import { ClipboardListIcon, FileClockIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BackLink, EmptyState, formatDate, Loaded, PageHeader } from "@/components/app/data-view"
import { actionsPath, REQUESTS_PATH } from "@/components/app/employees-actions-paths"
import { EventStatusLabel, RequestStatusLabel } from "@/components/app/employees-status"
import {
  describeSummary,
  formatCalendarDate,
  KIND_TEXT,
  type PersonnelAction,
  type PersonnelActionPage,
  type PersonnelActionRequest,
  type PersonnelActionRequestList,
} from "@/components/app/employees-types"
import { fetchApiJson, useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type ActionsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

const SOURCE_TEXT: Readonly<Record<PersonnelAction["source_type"], string>> = {
  application: "申請から確定",
  direct: "直接確定",
  system: "取り込み",
}

/** 人事発令の一覧。確定した発令の記録と、承認を待つ申請を分けて見せる。 */
export default function PersonnelActions({ initial }: ActionsProps) {
  return (
    <>
      <BackLink href="/employees">従業員の一覧</BackLink>
      <PageHeader
        title="人事発令"
        description="異動・役職・休職・退職などの発令と、その申請の状態です。"
      />
      <Tabs defaultValue="actions" className="gap-4">
        <TabsList aria-label="人事発令の表示">
          <TabsTrigger value="actions">確定した発令</TabsTrigger>
          <TabsTrigger value="requests">申請</TabsTrigger>
        </TabsList>
        <TabsContent value="actions">
          <ActionList initial={initial?.actions} />
        </TabsContent>
        <TabsContent value="requests">
          <RequestList initial={initial?.requests} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function ActionList(props: { initial: NonNullable<Props["initial"]>["actions"] | undefined }) {
  const first = useApiJson<PersonnelActionPage>(actionsPath(null), props.initial)
  const [more, setMore] = useState<{ data: PersonnelAction[]; cursor: string | null } | null>(null)
  const [failed, setFailed] = useState(false)

  async function loadMore(cursor: string) {
    setFailed(false)
    const page = await fetchApiJson<PersonnelActionPage>(actionsPath(cursor)).catch(
      () => ({ kind: "error" }) as const,
    )
    if (page.kind !== "ok") {
      setFailed(true)
      return
    }
    setMore((current) => ({
      data: [...(current?.data ?? []), ...page.data.data],
      cursor: page.data.next_cursor,
    }))
  }

  return (
    <Loaded state={first} fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
      {(page) => {
        const actions = [...page.data, ...(more?.data ?? [])]
        const cursor = more === null ? page.next_cursor : more.cursor
        if (actions.length === 0)
          return (
            <EmptyState
              icon={ClipboardListIcon}
              title="まだ確定した発令がありません"
              description="CLI か MCP で発令を確定すると、記録の新しい順にここへ並びます。"
            />
          )
        return (
          <section aria-labelledby="confirmed-actions">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 id="confirmed-actions">確定した発令</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>発令</TableHead>
                      <TableHead>従業員</TableHead>
                      <TableHead>内容</TableHead>
                      <TableHead>発令日</TableHead>
                      <TableHead>記録</TableHead>
                      <TableHead>経緯</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {actions.map((action) => (
                      <ActionRow key={action.id} action={action} />
                    ))}
                  </TableBody>
                </Table>
                {failed && (
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
                    さらに読む
                  </Button>
                </CardFooter>
              )}
            </Card>
          </section>
        )
      }}
    </Loaded>
  )
}

function ActionRow({ action }: { action: PersonnelAction }) {
  const corrected = action.corrected_by_action_id !== null
  const code = action.current_employee?.code ?? null

  return (
    <TableRow>
      <TableCell>
        <span className="flex flex-wrap items-center gap-2 font-medium">
          <span className={corrected ? "line-through" : undefined}>{KIND_TEXT[action.kind]}</span>
          {corrected && <EventStatusLabel status="corrected" />}
          {action.kind === "corrected" && <EventStatusLabel status="correction" />}
        </span>
      </TableCell>
      <TableCell>
        {code === null ? (
          (action.current_employee?.name ?? "従業員不明")
        ) : (
          <Link href={`/employees/${encodeURIComponent(code)}`}>
            {action.current_employee?.name ?? code}
          </Link>
        )}
      </TableCell>
      <TableCell className="whitespace-normal">{describeSummary(action.summary)}</TableCell>
      <TableCell>{formatCalendarDate(action.event_on)}</TableCell>
      <TableCell>{formatDate(action.recorded_at)}</TableCell>
      <TableCell>{SOURCE_TEXT[action.source_type]}</TableCell>
    </TableRow>
  )
}

function RequestList(props: { initial: NonNullable<Props["initial"]>["requests"] | undefined }) {
  const requests = useApiJson<PersonnelActionRequestList>(REQUESTS_PATH, props.initial)

  return (
    <Loaded state={requests} fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
      {(list) =>
        list.requests.length === 0 ? (
          <EmptyState
            icon={FileClockIcon}
            title="申請はありません"
            description="CLI か MCP で承認が要る発令を申請すると、ここで進み具合を確かめられます。"
          />
        ) : (
          <section aria-labelledby="action-requests">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 id="action-requests">人事発令の申請</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>発令</TableHead>
                      <TableHead>対象</TableHead>
                      <TableHead>状態</TableHead>
                      <TableHead>申請日</TableHead>
                      <TableHead>申請者</TableHead>
                      <TableHead>承認</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.requests.map((request) => (
                      <RequestRow key={request.id} request={request} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        )
      }
    </Loaded>
  )
}

function RequestRow({ request }: { request: PersonnelActionRequest }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{KIND_TEXT[request.kind]}</TableCell>
      <TableCell>
        <Link href={`/employees/${encodeURIComponent(request.target_employee_code)}`}>
          {request.target_employee_name ?? request.target_employee_code}
        </Link>
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap items-center gap-2">
          <RequestStatusLabel status={request.status} />
          {request.status === "pending" && request.current_step !== null && (
            <span>段階 {request.current_step}</span>
          )}
        </span>
      </TableCell>
      <TableCell>{formatDate(request.created_at)}</TableCell>
      <TableCell>{request.requested_by_employee_name ?? ""}</TableCell>
      <TableCell>
        {request.application_id !== null && (
          <Link href={`/applications/${request.application_id}`}>承認の進み具合を見る</Link>
        )}
      </TableCell>
    </TableRow>
  )
}
