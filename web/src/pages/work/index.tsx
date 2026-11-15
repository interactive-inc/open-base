import { ClipboardCheckIcon, ClipboardListIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState } from "react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { FeatureGate, useFeatures } from "@/components/app/business-feature"
import { employeeName, useEmployeeDirectory } from "@/components/app/business-directory"
import { WorkDefinitionStatusLabel, WorkOutcomeLabel } from "@/components/app/business-status"
import {
  formatDateTime,
  WORK_TRIGGER_TEXT,
  type EmployeeDirectory,
  type RecordPage,
  type WorkDefinition,
  type WorkRun,
} from "@/components/app/business-types"
import { EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
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
import type { Props } from "./index.server"

type WorkProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

type Initial = NonNullable<Props["initial"]>

const ALL = "all"

/** 業務の実行。繰り返す業務の定義と、一回ごとの実行の記録を並べる。 */
export default function Work({ email, pathname, initial }: WorkProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const features = useFeatures(initial?.features)

  return (
    <>
      <PageHeader
        title="業務の実行"
        description="繰り返す業務と、誰がいつ実行してどうなったかの記録です。"
      />
      <FeatureGate features={features} feature="work-execution" name="業務の実行">
        <WorkBody initial={initial} />
      </FeatureGate>
    </>
  )
}

function WorkBody({ initial }: { initial: Initial | undefined }) {
  const definitions = useApiJson<RecordPage<WorkDefinition>>(
    "/work-execution/definitions?limit=100",
    initial?.definitions ?? undefined,
  )
  const directory = useEmployeeDirectory()

  return (
    <>
      <Definitions definitions={definitions} directory={directory} />
      <Runs
        initial={initial?.runs ?? undefined}
        definitions={definitions.kind === "ok" ? definitions.data.data : []}
      />
    </>
  )
}

/** 業務の定義。一件ごとのカードに、識別名、版、責任者、実行の手引きを見せる。 */
function Definitions(props: {
  definitions: ApiJsonState<RecordPage<WorkDefinition>>
  directory: ApiJsonState<EmployeeDirectory>
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-medium">業務の定義</h2>
      <Loaded state={props.definitions} fallback={<RowsSkeleton rows={2} />}>
        {(page) =>
          page.data.length === 0 ? (
            <EmptyState
              icon={ClipboardListIcon}
              title="まだ業務がありません"
              description="CLI か MCP で業務を登録すると、ここに出ます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {[...page.data]
                .sort(
                  (a, b) =>
                    Number(b.status === "active") - Number(a.status === "active") ||
                    a.name.localeCompare(b.name, "ja"),
                )
                .map((definition) => (
                  <li key={definition.slug}>
                    <Card>
                      <CardHeader>
                        <CardTitle>{definition.name}</CardTitle>
                        <CardDescription>
                          {[
                            definition.slug,
                            `第${definition.revision}版`,
                            `責任者 ${employeeName(props.directory, definition.owner_employee_id)}`,
                            definition.agent_id === null ? null : "専用agentあり",
                            definition.tags.length === 0
                              ? null
                              : `タグ ${definition.tags.join("、")}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </CardDescription>
                        <CardAction>
                          <WorkDefinitionStatusLabel status={definition.status} />
                        </CardAction>
                      </CardHeader>
                      {definition.execution_note !== "" && (
                        <CardContent>
                          <p className="whitespace-pre-wrap">{definition.execution_note}</p>
                        </CardContent>
                      )}
                    </Card>
                  </li>
                ))}
            </ul>
          )
        }
      </Loaded>
    </section>
  )
}

/** 実行の記録の欄。業務が二つ以上あれば、業務で絞り込める。 */
function Runs(props: {
  initial: Initial["runs"] | undefined
  definitions: ReadonlyArray<WorkDefinition>
}) {
  const [slug, setSlug] = useState(ALL)
  const choices = [
    { value: ALL, label: "すべての業務" },
    ...props.definitions.map((definition) => ({ value: definition.slug, label: definition.name })),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>実行の記録</h2>
        </CardTitle>
        {props.definitions.length > 1 && (
          <CardAction>
            <Field orientation="horizontal" className="w-fit">
              <FieldLabel>業務で絞り込む</FieldLabel>
              <Select
                items={choices}
                value={slug}
                onValueChange={(value) => setSlug(typeof value === "string" ? value : ALL)}
              >
                <SelectTrigger size="sm">
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
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RunList
          // 絞り込みを変えたら読み直す。初めの読み込み結果は、すべての業務のときだけ使う。
          key={slug}
          path={
            slug === ALL
              ? "/work-execution/runs?limit=50"
              : `/work-execution/runs?limit=50&slug=${slug}`
          }
          initial={slug === ALL ? props.initial : undefined}
          definitions={props.definitions}
        />
      </CardContent>
    </Card>
  )
}

function RunList(props: {
  path: string
  initial: Initial["runs"] | undefined
  definitions: ReadonlyArray<WorkDefinition>
}) {
  const runs = useApiJson<RecordPage<WorkRun>>(props.path, props.initial ?? undefined)
  const names = new Map(props.definitions.map((definition) => [definition.slug, definition.name]))

  return (
    <Loaded state={runs} fallback={<Skeleton className="h-32 w-full" />}>
      {(page) =>
        page.data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ClipboardCheckIcon />
              </EmptyMedia>
              <EmptyTitle>まだ実行の記録がありません</EmptyTitle>
              <EmptyDescription>CLI か MCP で実行を記録すると、ここに出ます。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>業務</TableHead>
                  <TableHead>始めた日時</TableHead>
                  <TableHead>始め方</TableHead>
                  <TableHead>AI・agent</TableHead>
                  <TableHead>結果</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.data.map((run) => (
                  <TableRow key={`${run.reporter_account_id}-${run.id}`}>
                    <TableCell className="min-w-56 whitespace-normal">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/work/runs/${run.id}?slug=${run.slug}`}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {names.get(run.slug) ?? run.slug}
                          {run.corrects_id !== null && "（訂正）"}
                        </Link>
                        {run.summary !== "" && <span className="line-clamp-2">{run.summary}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatDateTime(run.started_at)}</TableCell>
                    <TableCell>
                      {run.trigger === null ? "記録なし" : WORK_TRIGGER_TEXT[run.trigger]}
                    </TableCell>
                    <TableCell>
                      {run.agent_id !== null
                        ? "agentが報告"
                        : run.ai_assisted
                          ? "AIを利用"
                          : "なし"}
                    </TableCell>
                    <TableCell>
                      <WorkOutcomeLabel outcome={run.outcome} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {page.next_offset !== null && (
              <p className="text-xs text-muted-foreground">新しい50件を表示しています。</p>
            )}
          </>
        )
      }
    </Loaded>
  )
}
