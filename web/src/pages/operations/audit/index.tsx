import { ScrollText, ShieldCheck } from "lucide-react"
import { Link } from "@void/react"
import { useState, type FormEvent } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CurrentProfile } from "@/components/app/app-shell"
import { EmptyState, Loaded, PageHeader, ViewSwitch } from "@/components/app/data-view"
import {
  auditApiPath,
  auditPageUrl,
  auditRangeError,
  EMPTY_FILTERS,
  type AuditFilters,
  type AuditLedger,
} from "@/components/app/operations-audit"
import { formatDateTime, OUTCOME, shortId } from "@/components/app/operations-format"
import type {
  AuditOutcome,
  CompanyAuditPage,
  SystemAuditPage,
} from "@/components/app/operations-types"
import { fetchApiJson, useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type AuditProps = Omit<Props, "initial" | "ledger" | "filters"> & {
  ledger?: AuditLedger
  filters?: AuditFilters
  initial?: Props["initial"]
}

const OUTCOME_ITEMS: ReadonlyArray<{
  value: string
  label: string
  outcome: AuditOutcome | ""
}> = [
  { value: "all", label: "すべて", outcome: "" },
  { value: "denied", label: "拒否", outcome: "denied" },
  { value: "failed", label: "失敗", outcome: "failed" },
  { value: "succeeded", label: "成功", outcome: "succeeded" },
]

/** 一覧の一行。会社とシステムの記録を同じ形にそろえる。 */
type Row = {
  id: string
  action: string
  outcome: AuditOutcome
  actor: string | null
  target: string | null
  at: string
  via: string | null
}

/** 監査の記録の一覧。期間・操作した人・操作・結果で絞り込む。 */
export default function AuditEvents({
  email,
  pathname,
  ledger = "company",
  filters = EMPTY_FILTERS,
  initial,
}: AuditProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const rangeError = auditRangeError(filters)

  return (
    <>
      <PageHeader
        title="監査の記録"
        description="誰がいつ何をしたかの記録です。記録は書き換えられません。"
        action={
          <Button variant="secondary" render={<Link href="/operations/audit/disclosure" />}>
            <ShieldCheck data-icon="inline-start" />
            開示の方針
          </Button>
        }
      />

      <ViewSwitch
        label="記録の種類"
        current={auditPageUrl(ledger, filters)}
        items={[
          { href: auditPageUrl("company", filters), label: "業務の記録" },
          { href: auditPageUrl("system", filters), label: "基盤の記録" },
        ]}
      />

      <FilterForm ledger={ledger} filters={filters} />

      {rangeError !== null ? (
        <Alert variant="destructive">
          <AlertDescription>{rangeError}</AlertDescription>
        </Alert>
      ) : ledger === "company" ? (
        <CompanyList
          path={auditApiPath("company", filters)}
          initial={initial?.company ?? undefined}
        />
      ) : (
        <SystemList path={auditApiPath("system", filters)} initial={initial?.system ?? undefined} />
      )}
    </>
  )
}

/** 入力の誤り。どの欄の誤りかを持ち、その欄の下に出す。 */
type FilterProblem = { field: "actor" | "range"; message: string }

function FilterForm(props: { ledger: AuditLedger; filters: AuditFilters }) {
  const [values, setValues] = useState<AuditFilters>(props.filters)
  const [error, setError] = useState<FilterProblem | null>(null)

  function set<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const actor = values.actor.trim()
    if (actor !== "" && !/^[0-9a-f-]{36}$/i.test(actor)) {
      setError({
        field: "actor",
        message: "操作した人は、アカウントの番号（36文字）で入れてください。",
      })
      return
    }
    const range = auditRangeError(values)
    if (range !== null) {
      setError({ field: "range", message: range })
      return
    }
    setError(null)
    location.assign(auditPageUrl(props.ledger, { ...values, actor, action: values.action.trim() }))
  }

  return (
    <form noValidate onSubmit={submit} aria-label="記録の絞り込み">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>絞り込み</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel>この日から</FieldLabel>
            <Input type="date" value={values.from} onValueChange={(value) => set("from", value)} />
          </Field>
          <Field invalid={error?.field === "range"}>
            <FieldLabel>この日まで</FieldLabel>
            <Input type="date" value={values.to} onValueChange={(value) => set("to", value)} />
            {error?.field === "range" && <FieldError>{error.message}</FieldError>}
          </Field>
          <Field>
            <FieldLabel>結果</FieldLabel>
            <Select
              items={[...OUTCOME_ITEMS]}
              value={values.outcome === "" ? "all" : values.outcome}
              onValueChange={(value) =>
                set("outcome", OUTCOME_ITEMS.find((item) => item.value === value)?.outcome ?? "")
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>操作</FieldLabel>
            <Input
              value={values.action}
              onValueChange={(value) => set("action", value)}
              placeholder="例: employee.update"
              maxLength={200}
            />
          </Field>
          <Field invalid={error?.field === "actor"}>
            <FieldLabel>操作した人（アカウントの番号）</FieldLabel>
            <Input
              value={values.actor}
              onValueChange={(value) => set("actor", value)}
              maxLength={36}
              spellCheck={false}
            />
            {error?.field === "actor" && <FieldError>{error.message}</FieldError>}
          </Field>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button
            variant="secondary"
            render={<Link href={auditPageUrl(props.ledger, EMPTY_FILTERS)} />}
          >
            条件を外す
          </Button>
          <Button type="submit">絞り込む</Button>
        </CardFooter>
      </Card>
    </form>
  )
}

function CompanyList(props: { path: string; initial: Props["initial"]["company"] | undefined }) {
  const first = useApiJson<CompanyAuditPage>(props.path, props.initial ?? undefined)
  const [more, setMore] = useState<{ rows: Row[]; cursor: string | null } | null>(null)
  const [error, setError] = useState(false)

  return (
    <Loaded state={first} fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      {(page) => {
        const rows = [...page.data.map(fromCompany), ...(more?.rows ?? [])]
        const cursor = more === null ? page.next_cursor : more.cursor

        async function loadMore() {
          if (cursor === null) return
          setError(false)
          const result = await fetchApiJson<CompanyAuditPage>(
            `${props.path}&cursor=${encodeURIComponent(cursor)}`,
          ).catch(() => ({ kind: "error" }) as const)
          if (result.kind !== "ok") {
            setError(true)
            return
          }
          setMore({
            rows: [...(more?.rows ?? []), ...result.data.data.map(fromCompany)],
            cursor: result.data.next_cursor,
          })
        }

        return (
          <EventList
            rows={rows}
            ledger="company"
            hasMore={cursor !== null}
            error={error}
            onMore={loadMore}
          />
        )
      }}
    </Loaded>
  )
}

function SystemList(props: { path: string; initial: Props["initial"]["system"] | undefined }) {
  const first = useApiJson<SystemAuditPage>(props.path, props.initial ?? undefined)
  const [more, setMore] = useState<Row[]>([])
  const [error, setError] = useState(false)

  return (
    <Loaded state={first} fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      {(page) => {
        const rows = [...page.events.map(fromSystem), ...more]

        async function loadMore() {
          setError(false)
          // 最初の頁の境目を渡し、読む間に増えた記録で位置がずれないようにする。
          const boundary =
            page.boundary === null ? "" : `&boundary=${encodeURIComponent(page.boundary)}`
          const result = await fetchApiJson<SystemAuditPage>(
            `${props.path}&offset=${rows.length}${boundary}`,
          ).catch(() => ({ kind: "error" }) as const)
          if (result.kind !== "ok") {
            setError(true)
            return
          }
          setMore([...more, ...result.data.events.map(fromSystem)])
        }

        return (
          <EventList
            rows={rows}
            ledger="system"
            total={page.total}
            hasMore={rows.length < page.total}
            error={error}
            onMore={loadMore}
          />
        )
      }}
    </Loaded>
  )
}

function EventList(props: {
  rows: ReadonlyArray<Row>
  ledger: AuditLedger
  total?: number
  hasMore: boolean
  error: boolean
  /** 続きを読む。読み終わるまでボタンは押せない状態になる。 */
  onMore: () => Promise<void>
}) {
  if (props.rows.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="条件に合う記録はありません"
        description="期間を広げるか、条件を外して確かめてください。"
      />
    )
  }
  const problems = props.rows.filter((row) => row.outcome !== "succeeded").length
  const suffix = props.ledger === "system" ? "?ledger=system" : ""

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>記録</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p>
          {props.total === undefined
            ? `${props.rows.length} 件を表示中`
            : `${props.total} 件中 ${props.rows.length} 件を表示中`}
          {problems > 0 && `。拒否・失敗が ${problems} 件あります`}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>操作</TableHead>
              <TableHead>結果</TableHead>
              <TableHead>日時</TableHead>
              <TableHead>操作した人</TableHead>
              <TableHead>対象</TableHead>
              <TableHead>経路</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono">
                  <Link
                    href={`/operations/audit/${encodeURIComponent(row.id)}${suffix}`}
                    className="underline underline-offset-4"
                  >
                    {row.action}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={OUTCOME[row.outcome].variant}>{OUTCOME[row.outcome].text}</Badge>
                </TableCell>
                <TableCell className="tabular-nums">{formatDateTime(row.at)}</TableCell>
                <TableCell className="font-mono">
                  {row.actor === null ? "なし" : shortId(row.actor)}
                </TableCell>
                <TableCell>{row.target ?? "なし"}</TableCell>
                <TableCell>{row.via ?? "なし"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {props.error && (
          <Alert variant="destructive">
            <AlertDescription>
              続きを読み込めませんでした。少し待ってからやり直してください。
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      {props.hasMore && (
        <CardFooter className="justify-end">
          <Button variant="secondary" onClick={props.onMore}>
            さらに読み込む
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

function fromCompany(event: CompanyAuditPage["data"][number]): Row {
  return {
    id: event.event_id,
    action: event.action,
    outcome: event.outcome,
    actor: event.actor_account_id,
    target:
      event.target_type === null
        ? null
        : `${event.target_type}${event.target_id === null ? "" : ` ${event.target_id}`}`,
    at: event.created_at,
    via: event.client_name,
  }
}

function fromSystem(event: SystemAuditPage["events"][number]): Row {
  return {
    id: event.event_id,
    action: event.action,
    outcome: event.outcome,
    actor: event.actor_account_id,
    target: `${event.target_type}${event.target_id === null ? "" : ` ${shortId(event.target_id)}`}`,
    at: event.occurred_at,
    via: null,
  }
}
