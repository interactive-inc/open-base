import { BriefcaseIcon } from "lucide-react"
import { useState } from "react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { FeatureGate, isFeatureDisabled, useFeatures } from "@/components/app/business-feature"
import { employeeName, useEmployeeDirectory } from "@/components/app/business-directory"
import { ProjectList } from "@/components/app/business-project-list"
import {
  countByProjectStatus,
  PROJECT_STATUS_TEXT,
  PROJECT_STATUSES,
  type CustomerRecord,
  type ProjectRecord,
  type ProjectStatus,
  type RecordPage,
} from "@/components/app/business-types"
import { EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Props } from "./index.server"

type ProjectsProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

type Initial = NonNullable<Props["initial"]>

type Filter = ProjectStatus | "all"

/** 顧客の機能が無効なときは読まない。 */
const NOT_READ: ApiJsonState<RecordPage<CustomerRecord>> = { kind: "forbidden" }

/** 気にする順。進行中を先に、終わったものを後に並べる。 */
const ORDER: Readonly<Record<ProjectStatus, number>> = {
  active: 0,
  planned: 1,
  completed: 2,
  cancelled: 3,
}

/** 案件の一覧。状態ごとの件数で絞り込み、一件ごとにいまどの段階かを見せる。 */
export default function Projects({ email, pathname, initial }: ProjectsProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const features = useFeatures(initial?.features)

  return (
    <>
      <PageHeader
        title="案件"
        description="受けている案件と、それぞれがいまどの段階にあるかです。"
      />
      <FeatureGate features={features} feature="client-project" name="案件">
        <ProjectsBody
          initial={initial}
          customersEnabled={!isFeatureDisabled(features, "customer")}
        />
      </FeatureGate>
    </>
  )
}

function ProjectsBody(props: { initial: Initial | undefined; customersEnabled: boolean }) {
  const projects = useApiJson<RecordPage<ProjectRecord>>(
    "/client-project/records?kind=project&limit=100",
    props.initial?.projects ?? undefined,
  )
  const customers = useApiJson<RecordPage<CustomerRecord>>(
    "/customer/records?limit=100",
    props.customersEnabled ? (props.initial?.customers ?? undefined) : NOT_READ,
  )
  const directory = useEmployeeDirectory()
  const [filter, setFilter] = useState<Filter>("all")

  function customerName(id: string): string | null {
    if (customers.kind !== "ok") return null
    return customers.data.data.find((customer) => customer.id === id)?.name ?? null
  }

  return (
    <Loaded state={projects} fallback={<RowsSkeleton />}>
      {(page) => {
        if (page.data.length === 0) {
          return (
            <EmptyState
              icon={BriefcaseIcon}
              title="まだ案件がありません"
              description="CLI か MCP で案件を登録すると、ここに出ます。"
            />
          )
        }
        const counts = countByProjectStatus(page.data)
        const shown = page.data
          .filter((project) => filter === "all" || project.status === filter)
          .sort(
            (a, b) =>
              ORDER[a.status] - ORDER[b.status] ||
              (a.due_on ?? "9999").localeCompare(b.due_on ?? "9999") ||
              a.name.localeCompare(b.name, "ja"),
          )
        // 選択肢は5つあるので、並べず一つの選択にまとめる。件数は選択肢の名前で見せる。
        const choices = [
          { value: "all", label: `すべて ${page.data.length}件` },
          ...PROJECT_STATUSES.map((status) => ({
            value: status,
            label: `${PROJECT_STATUS_TEXT[status]} ${counts[status]}件`,
          })),
        ]
        return (
          <div className="flex flex-col gap-4">
            <Field orientation="horizontal" className="w-fit">
              <FieldLabel>状態で絞り込む</FieldLabel>
              <Select
                items={choices}
                value={filter}
                onValueChange={(value) => setFilter(isFilter(value) ? value : "all")}
              >
                {/* ページの地に直接置くので、地の色と混ざらないようカードの色にする。 */}
                <SelectTrigger className="bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {choices.map((choice) => (
                    <SelectItem key={choice.value} value={choice.value}>
                      {choice.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {shown.length === 0 ? (
              <p className="text-sm">
                {filter === "all" ? "" : PROJECT_STATUS_TEXT[filter]}の案件はありません。
              </p>
            ) : (
              <ProjectList
                projects={shown}
                customerName={customerName}
                ownerName={(id) => employeeName(directory, id)}
              />
            )}
            {page.next_offset !== null && (
              <p className="text-xs text-muted-foreground">最初の100件を数えて表示しています。</p>
            )}
          </div>
        )
      }}
    </Loaded>
  )
}

function isFilter(value: unknown): value is Filter {
  return value === "all" || PROJECT_STATUSES.some((status) => status === value)
}
