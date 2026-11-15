import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ClipboardListIcon,
  SearchIcon,
  UsersIcon,
} from "lucide-react"
import { Link } from "@void/react"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState, Loaded, PageHeader } from "@/components/app/data-view"
import { ChoiceField } from "@/components/app/employees-choice-field"
import { DepartmentField } from "@/components/app/employees-department-field"
import {
  directoryPath,
  filtersToSearch,
  NO_FILTERS,
  PAGE_SIZE,
  type DirectoryFilters,
} from "@/components/app/employees-directory-query"
import { EmployeeStatusLabel } from "@/components/app/employees-status"
import type { DirectoryPage, OrganizationUnit } from "@/components/app/employees-types"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./index.server"

type EmployeesProps = Omit<Props, "initial" | "filters"> & {
  initial?: Props["initial"]
  filters?: Props["filters"]
}

const STATUS_CHOICES = [
  { value: "all", label: "すべて" },
  { value: "active", label: "在籍" },
  { value: "leave", label: "休職中" },
  { value: "retired", label: "退職" },
]

/** 従業員の名簿。名前・部署・状態で絞り込み、一人を開く。 */
export default function Employees({ filters, initial }: EmployeesProps) {
  const units = useApiJson<ReadonlyArray<OrganizationUnit>>(
    "/company/organization-units",
    initial?.units,
  )
  const first = filters ?? NO_FILTERS
  const [applied, setApplied] = useState<DirectoryFilters>(first)
  const path = directoryPath(applied)

  function apply(next: DirectoryFilters) {
    setApplied(next)
    // 条件をURLに残し、共有と再読み込みで同じ一覧を開けるようにする。
    if (location.pathname === "/employees")
      history.replaceState(null, "", `/employees${filtersToSearch(next)}`)
  }

  return (
    <>
      <PageHeader
        title="従業員"
        description="従業員を探して、今の所属とこれまでの人事を確かめます。"
        action={
          <Button variant="secondary" render={<Link href="/employees/actions" />}>
            <ClipboardListIcon data-icon="inline-start" />
            人事発令
          </Button>
        }
      />

      <SearchForm initial={first} units={units} onApply={apply} />

      <Results
        key={path}
        path={path}
        filters={applied}
        initial={path === directoryPath(first) ? initial?.directory : undefined}
        onPage={(offset) => apply({ ...applied, offset })}
      />
    </>
  )
}

function SearchForm(props: {
  initial: DirectoryFilters
  units: Parameters<typeof DepartmentField>[0]["units"]
  onApply: (filters: DirectoryFilters) => void
}) {
  const [q, setQ] = useState(props.initial.q)
  const [department, setDepartment] = useState(props.initial.department)
  const [status, setStatus] = useState<DirectoryFilters["status"]>(props.initial.status)

  function submit(event: FormEvent) {
    event.preventDefault()
    props.onApply({ q: q.trim(), department: department.trim(), status, offset: 0 })
  }

  return (
    <section aria-labelledby="employee-search">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="employee-search">絞り込み</h2>
          </CardTitle>
        </CardHeader>
        <form onSubmit={submit} className="contents">
          <CardContent>
            <FieldGroup className="max-w-xl">
              <Field name="q">
                <FieldLabel>名前・コード・メール</FieldLabel>
                <Input type="search" value={q} onValueChange={setQ} maxLength={200} />
              </Field>
              <DepartmentField
                label="部署"
                units={props.units}
                value={department}
                onChange={setDepartment}
                emptyLabel="すべての部署"
                description="部署のコードか名前を入力してください。"
              />
              <ChoiceField
                label="状態"
                choices={STATUS_CHOICES}
                value={status === "" ? "all" : status}
                onChange={(value) =>
                  setStatus(
                    value === "active" || value === "leave" || value === "retired" ? value : "",
                  )
                }
              />
            </FieldGroup>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">
              <SearchIcon data-icon="inline-start" />
              探す
            </Button>
          </CardFooter>
        </form>
      </Card>
    </section>
  )
}

function Results(props: {
  path: string
  filters: DirectoryFilters
  initial: NonNullable<Props["initial"]>["directory"] | undefined
  onPage: (offset: number) => void
}) {
  const directory = useApiJson<DirectoryPage>(props.path, props.initial)
  const filtered =
    props.filters.q !== "" || props.filters.department !== "" || props.filters.status !== ""

  return (
    <Loaded state={directory} fallback={<Skeleton className="h-48 w-full rounded-2xl" />}>
      {(page) =>
        page.data.length === 0 ? (
          <EmptyState
            icon={UsersIcon}
            title={filtered ? "条件に合う従業員がいません" : "まだ従業員がいません"}
            description={
              filtered
                ? "条件を変えて探し直してください。"
                : "CLI か MCP で従業員を登録すると、ここに出ます。"
            }
          />
        ) : (
          <section aria-labelledby="employee-list">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 id="employee-list">従業員の一覧</h2>
                </CardTitle>
                <CardDescription>
                  {page.total}人中 {props.filters.offset + 1}〜
                  {props.filters.offset + page.data.length}人目
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>名前</TableHead>
                      <TableHead>コード</TableHead>
                      <TableHead>所属</TableHead>
                      <TableHead>役職</TableHead>
                      <TableHead>状態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {page.data.map((employee) => (
                      <Row key={employee.id} employee={employee} />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              <Pager
                offset={props.filters.offset}
                count={page.data.length}
                total={page.total}
                onPage={props.onPage}
              />
            </Card>
          </section>
        )
      }
    </Loaded>
  )
}

function Row({ employee }: { employee: DirectoryPage["data"][number] }) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        {employee.code === null ? (
          employee.name
        ) : (
          <Link href={`/employees/${encodeURIComponent(employee.code)}`}>{employee.name}</Link>
        )}
      </TableCell>
      <TableCell>{employee.code ?? "コード未設定"}</TableCell>
      <TableCell>{employee.organization_unit_name ?? "所属なし"}</TableCell>
      <TableCell>{employee.position ?? ""}</TableCell>
      <TableCell>
        <EmployeeStatusLabel status={employee.status} />
      </TableCell>
    </TableRow>
  )
}

function Pager(props: {
  offset: number
  count: number
  total: number
  onPage: (offset: number) => void
}) {
  const hasPrevious = props.offset > 0
  const hasNext = props.offset + props.count < props.total
  if (!hasPrevious && !hasNext) return null
  return (
    <CardFooter className="justify-end gap-2">
      <Button
        variant="secondary"
        disabled={!hasPrevious}
        onClick={() => props.onPage(Math.max(0, props.offset - PAGE_SIZE))}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        前へ
      </Button>
      <Button
        variant="secondary"
        disabled={!hasNext}
        onClick={() => props.onPage(props.offset + PAGE_SIZE)}
      >
        次へ
        <ArrowRightIcon data-icon="inline-end" />
      </Button>
    </CardFooter>
  )
}
