import { HandshakeIcon, SearchIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { FeatureGate, isFeatureDisabled, useFeatures } from "@/components/app/business-feature"
import { CatalogStatusLabel } from "@/components/app/business-status"
import {
  countByProjectStatus,
  PROJECT_STATUS_TEXT,
  type CustomerRecord,
  type ProjectRecord,
  type ProjectStatus,
  type RecordPage,
} from "@/components/app/business-types"
import { EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Props } from "./index.server"

type CustomersProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

type Initial = NonNullable<Props["initial"]>

/** 案件の機能が無効なときは読まない。 */
const NOT_READ: ApiJsonState<RecordPage<ProjectRecord>> = { kind: "forbidden" }

/** 案件の段階を、先に気にするものから並べる。 */
const SUMMARY_ORDER: ReadonlyArray<ProjectStatus> = ["active", "planned", "completed", "cancelled"]

/** 顧客の一覧。顧客ごとに、いまどの段階の案件をいくつ持っているかを並べる。 */
export default function Customers({ email, pathname, initial }: CustomersProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const features = useFeatures(initial?.features)

  return (
    <>
      <PageHeader
        title="顧客"
        description="取引のある顧客と、それぞれの案件がいまどの段階にあるかです。"
      />
      <FeatureGate features={features} feature="customer" name="顧客">
        <CustomerList
          initial={initial}
          projectsEnabled={!isFeatureDisabled(features, "client-project")}
        />
      </FeatureGate>
    </>
  )
}

function CustomerList(props: { initial: Initial | undefined; projectsEnabled: boolean }) {
  const customers = useApiJson<RecordPage<CustomerRecord>>(
    "/customer/records?limit=100",
    props.initial?.customers ?? undefined,
  )
  const projects = useApiJson<RecordPage<ProjectRecord>>(
    "/client-project/records?kind=project&limit=100",
    props.projectsEnabled ? (props.initial?.projects ?? undefined) : NOT_READ,
  )
  const [query, setQuery] = useState("")

  return (
    <Loaded state={customers} fallback={<RowsSkeleton />}>
      {(page) => {
        if (page.data.length === 0) {
          return (
            <EmptyState
              icon={HandshakeIcon}
              title="まだ顧客がいません"
              description="CLI か MCP で顧客を登録すると、ここに出ます。"
            />
          )
        }
        const needle = query.trim().toLowerCase()
        const shown = [...page.data]
          .filter(
            (customer) =>
              needle === "" ||
              [customer.name, ...customer.aliases].some((text) =>
                text.toLowerCase().includes(needle),
              ),
          )
          .sort(
            (a, b) =>
              Number(b.status === "active") - Number(a.status === "active") ||
              a.name.localeCompare(b.name, "ja"),
          )
        return (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>取引のある顧客</h2>
              </CardTitle>
              <CardDescription>{page.data.length}件</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field className="max-w-sm">
                <FieldLabel>顧客を探す</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={query}
                    onValueChange={setQuery}
                    placeholder="顧客名か別名"
                  />
                </InputGroup>
              </Field>
              {shown.length === 0 ? (
                <p className="text-sm">「{query.trim()}」に当てはまる顧客はいません。</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>顧客</TableHead>
                      <TableHead>案件</TableHead>
                      <TableHead>状態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shown.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Link
                              href={`/customers/${customer.id}`}
                              className="font-medium underline-offset-4 hover:underline"
                            >
                              {customer.name}
                            </Link>
                            {customer.aliases.length > 0 && (
                              <span className="text-xs text-muted-foreground">
                                別名 {customer.aliases.join("、")}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ProjectSummary projects={projects} customerId={customer.id} />
                        </TableCell>
                        <TableCell>
                          <CatalogStatusLabel status={customer.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {page.next_offset !== null && (
              <CardFooter>
                <p className="text-xs text-muted-foreground">
                  最初の100件を表示しています。見つからないときは名前で探してください。
                </p>
              </CardFooter>
            )}
          </Card>
        )
      }}
    </Loaded>
  )
}

/** その顧客の案件を、段階ごとの件数で一行にまとめる。案件を読めないときは何も出さない。 */
function ProjectSummary(props: {
  projects: ApiJsonState<RecordPage<ProjectRecord>>
  customerId: string
}) {
  if (props.projects.kind !== "ok") return null
  const mine = props.projects.data.data.filter(
    (project) => project.customer_id === props.customerId,
  )
  if (mine.length === 0) {
    return <span className="text-muted-foreground">案件はまだありません</span>
  }
  const counts = countByProjectStatus(mine)
  return (
    <span className="flex flex-wrap gap-2">
      {SUMMARY_ORDER.filter((status) => counts[status] > 0).map((status) => (
        <span
          key={status}
          className={
            status === "active"
              ? "font-medium"
              : status === "cancelled"
                ? "text-destructive"
                : "text-muted-foreground"
          }
        >
          {PROJECT_STATUS_TEXT[status]}の案件 {counts[status]}
        </span>
      ))}
    </span>
  )
}
