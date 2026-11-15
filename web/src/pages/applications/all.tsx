import { InfoIcon, SearchIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState, type FormEvent } from "react"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  isReturnedStep,
  type AdminApplicationList,
  type TemplateList,
} from "@/components/app/application-types"
import {
  APPLICATION_PAGE_SIZE,
  toApplicationListPath,
  toFilterQuery,
  type ApplicationFilter,
} from "@/components/app/applications-filter"
import { ReturnedLabel } from "@/components/app/applications-returned-label"
import {
  BackLink,
  EmptyState,
  formatDate,
  Loaded,
  PageHeader,
  RowsSkeleton,
} from "@/components/app/data-view"
import { ApplicationStatusLabel, type ApplicationStatus } from "@/components/app/phase-bar"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Props } from "./all.server"

type AllProps = Omit<Props, "initial" | "filter"> & {
  filter?: ApplicationFilter
  initial?: Props["initial"]
}

const DEFAULT_FILTER: ApplicationFilter = {
  scope: "all",
  status: null,
  template: null,
  department: null,
  offset: 0,
}

const SCOPES = [
  { value: "all", label: "全社" },
  { value: "department", label: "部署を指定" },
] as const

const STATUSES: ReadonlyArray<{ value: ApplicationStatus | "any"; label: string }> = [
  { value: "any", label: "すべての状態" },
  { value: "pending", label: "承認待ち" },
  { value: "approved", label: "承認済み" },
  { value: "rejected", label: "却下" },
]

/** 全社または部署の申請を、状態やテンプレートで絞って見る。読める範囲はサーバーが決める。 */
export default function AllApplications({ email, pathname, filter, initial }: AllProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const templates = useApiJson<TemplateList>(
    "/company/application-templates?limit=100",
    initial?.templates,
  )
  const [current, setCurrent] = useState<ApplicationFilter>(filter ?? DEFAULT_FILTER)
  const path = toApplicationListPath(current)

  function apply(next: ApplicationFilter) {
    setCurrent(next)
    const query = toFilterQuery(next)
    history.replaceState(null, "", query === "" ? location.pathname : `?${query}`)
  }

  return (
    <>
      <BackLink href="/applications">申請</BackLink>
      <PageHeader
        title="全社の申請"
        description="会社の申請を状態やテンプレートで絞って見ます。部署を指定すると、その部署の人が出した申請を見ます。"
      />
      <Filters
        filter={current}
        templates={templates.kind === "ok" ? templates.data : null}
        onApply={apply}
      />
      {path === null ? (
        <Alert role="status">
          <InfoIcon aria-hidden="true" />
          <AlertDescription>部署のコードを入れて「絞り込む」を押してください。</AlertDescription>
        </Alert>
      ) : (
        <Results
          key={path}
          path={path}
          initial={path === initial?.path ? (initial.applications ?? undefined) : undefined}
          filter={current}
          onPage={(offset) => apply({ ...current, offset })}
        />
      )}
    </>
  )
}

function Filters(props: {
  filter: ApplicationFilter
  templates: TemplateList | null
  onApply: (filter: ApplicationFilter) => void
}) {
  const [department, setDepartment] = useState(props.filter.department ?? "")
  const [error, setError] = useState<string | null>(null)
  const templateItems = [
    { value: "any", label: "すべてのテンプレート" },
    ...(props.templates?.data ?? []).map((template) => ({
      value: template.code,
      label: template.name,
    })),
  ]
  const departmentScope = props.filter.scope === "department"

  function submit(event: FormEvent) {
    event.preventDefault()
    const code = department.trim()
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) {
      setError("部署のコードを、半角の英数字と _ - で入力してください。")
      return
    }
    setError(null)
    props.onApply({ ...props.filter, department: code, offset: 0 })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>絞り込み</h2>
        </CardTitle>
      </CardHeader>
      {/* 部署を指定するときだけ、部署のコードを送る。contentsで枠の並びを崩さない。 */}
      <form noValidate onSubmit={submit} className="contents">
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel>範囲</FieldLabel>
            <Select
              items={[...SCOPES]}
              value={props.filter.scope}
              onValueChange={(value) => {
                if (value === "all" || value === "department") {
                  props.onApply({ ...props.filter, scope: value, offset: 0 })
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>状態</FieldLabel>
            <Select
              items={[...STATUSES]}
              value={props.filter.status ?? "any"}
              onValueChange={(value) => {
                const status = STATUSES.find((item) => item.value === value)
                if (status === undefined) return
                props.onApply({
                  ...props.filter,
                  status: status.value === "any" ? null : status.value,
                  offset: 0,
                })
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {departmentScope ? (
            <Field invalid={error !== null}>
              <FieldLabel>部署のコード</FieldLabel>
              <Input
                value={department}
                onValueChange={(value) => {
                  setDepartment(value)
                  setError(null)
                }}
                maxLength={100}
              />
              {error !== null && <FieldError>{error}</FieldError>}
            </Field>
          ) : (
            <Field>
              <FieldLabel>テンプレート</FieldLabel>
              <Select
                items={templateItems}
                value={props.filter.template ?? "any"}
                onValueChange={(value) => {
                  if (typeof value !== "string") return
                  props.onApply({
                    ...props.filter,
                    template: value === "any" ? null : value,
                    offset: 0,
                  })
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </CardContent>
        {departmentScope && (
          <CardFooter className="justify-end">
            <Button type="submit">
              <SearchIcon data-icon="inline-start" aria-hidden="true" />
              絞り込む
            </Button>
          </CardFooter>
        )}
      </form>
    </Card>
  )
}

function Results(props: {
  path: string
  initial: Exclude<ApiJsonState<AdminApplicationList>, { kind: "loading" }> | undefined
  filter: ApplicationFilter
  onPage: (offset: number) => void
}) {
  const applications = useApiJson<AdminApplicationList>(props.path, props.initial)

  return (
    <Loaded state={applications} fallback={<RowsSkeleton />}>
      {(list) =>
        list.data.length === 0 ? (
          <EmptyState
            icon={SearchIcon}
            title="当てはまる申請はありません"
            description="絞り込みを変えると、ほかの申請を探せます。"
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>当てはまる申請</h2>
              </CardTitle>
              <CardDescription>
                {list.total} 件のうち {props.filter.offset + 1}〜
                {props.filter.offset + list.data.length} 件目
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申請</TableHead>
                    <TableHead>申請者</TableHead>
                    <TableHead>部署</TableHead>
                    <TableHead>申請日</TableHead>
                    <TableHead className="text-right">申請番号</TableHead>
                    <TableHead>状態</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        <Link href={`/applications/${item.id}`} className="hover:underline">
                          {item.template_name}
                        </Link>
                      </TableCell>
                      <TableCell>{item.applicant_name || "申請者不明"}</TableCell>
                      <TableCell>{item.applicant_dept_name ?? "所属なし"}</TableCell>
                      <TableCell className="tabular-nums">{formatDate(item.created_at)}</TableCell>
                      <TableCell className="text-right tabular-nums">{item.id}</TableCell>
                      <TableCell>
                        <span className="flex gap-2">
                          {isReturnedStep(item.current_step) && <ReturnedLabel />}
                          <ApplicationStatusLabel status={item.status} />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Button
                variant="secondary"
                disabled={props.filter.offset === 0}
                onClick={() =>
                  props.onPage(Math.max(0, props.filter.offset - APPLICATION_PAGE_SIZE))
                }
              >
                前の{APPLICATION_PAGE_SIZE}件
              </Button>
              <Button
                variant="secondary"
                disabled={props.filter.offset + list.data.length >= list.total}
                onClick={() => props.onPage(props.filter.offset + APPLICATION_PAGE_SIZE)}
              >
                次の{APPLICATION_PAGE_SIZE}件
              </Button>
            </CardFooter>
          </Card>
        )
      }
    </Loaded>
  )
}
