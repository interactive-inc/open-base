import { HistoryIcon } from "lucide-react"
import { Link } from "@void/react"
import { useEffect, useState, type ReactNode } from "react"
import type { CurrentProfile } from "@/components/app/app-shell"
import { FeatureGate, useFeatures } from "@/components/app/business-feature"
import { employeeName, useEmployeeDirectory } from "@/components/app/business-directory"
import { WorkOutcomeLabel } from "@/components/app/business-status"
import {
  findWorkRun,
  formatDateTime,
  WORK_TRIGGER_TEXT,
  type RecordPage,
  type WorkDefinition,
  type WorkRun,
} from "@/components/app/business-types"
import { BackLink, Loaded, PageHeader } from "@/components/app/data-view"
import { fetchApiJson, useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Props } from "./[id].server"

type RunProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

type Initial = NonNullable<Props["initial"]>

/** 参照の種類のうち、この画面から開ける先。 */
const REFERENCE_LINKS: Readonly<Record<string, (id: string) => string>> = {
  "client-project": (id) => `/projects/${id}`,
  customer: (id) => `/customers/${id}`,
}

/** 実行の記録の一件。何を、いつ、誰が実行し、どうなったかと、訂正の関係を見せる。 */
export default function WorkRunPage({ email, pathname, id, slug, initial }: RunProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const features = useFeatures(initial?.features)

  return (
    <>
      <BackLink href="/work">業務の実行</BackLink>
      <FeatureGate
        features={features}
        feature="work-execution"
        name="業務の実行"
        fallback={<Skeleton className="h-64 w-full" />}
      >
        <RunBody id={id} slug={slug} initial={initial?.run ?? undefined} />
      </FeatureGate>
    </>
  )
}

/** 一件を探す。loaderが先に探した結果があればそれを使う。 */
function useWorkRun(
  id: string,
  slug: string | null,
  initial: Initial["run"] | undefined,
): ApiJsonState<WorkRun | null> {
  const [state, setState] = useState<ApiJsonState<WorkRun | null>>(initial ?? { kind: "loading" })
  const loaded = initial !== undefined

  useEffect(() => {
    if (loaded) return
    const controller = new AbortController()
    findWorkRun(id, slug, (path) => fetchApiJson<RecordPage<WorkRun>>(path, controller.signal))
      .then(setState)
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: "error" })
      })
    return () => controller.abort()
  }, [id, slug, loaded])

  return state
}

function RunBody(props: { id: string; slug: string | null; initial: Initial["run"] | undefined }) {
  const run = useWorkRun(props.id, props.slug, props.initial)

  return (
    <Loaded state={run} fallback={<Skeleton className="h-64 w-full" />}>
      {(found) =>
        found === null ? (
          <Alert role="status">
            <AlertDescription>
              この実行の記録は見つかりません。一覧から選び直してください。
            </AlertDescription>
          </Alert>
        ) : (
          <Run run={found} />
        )
      }
    </Loaded>
  )
}

function Run({ run }: { run: WorkRun }) {
  // 実行したときの版の定義を読み、その名前を見出しにする。
  const applied = useApiJson<RecordPage<WorkDefinition>>(
    `/work-execution/definitions?slug=${run.slug}&revision=${run.definition_revision}`,
  )
  const directory = useEmployeeDirectory()
  const definition = applied.kind === "ok" ? applied.data.data[0] : undefined

  return (
    <>
      <PageHeader
        title={definition?.name ?? run.slug}
        description={`${formatDateTime(run.started_at)} 〜 ${formatDateTime(run.finished_at)}`}
        badges={<WorkOutcomeLabel outcome={run.outcome} />}
      />

      {run.corrects_id !== null && (
        <Alert role="status">
          <HistoryIcon />
          <AlertDescription>
            この記録は
            <Link href={`/work/runs/${run.corrects_id}?slug=${run.slug}`}>以前の記録</Link>
            を訂正しています。
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>結果の概要</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">
            {run.summary === "" ? "概要は記録されていません。" : run.summary}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>記録の内容</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[12rem_1fr]">
            <Fact term="業務">
              {run.slug}（第{run.definition_revision}版）
            </Fact>
            <Fact term="受け付けた日時">{formatDateTime(run.received_at)}</Fact>
            <Fact term="始め方">
              {run.trigger === null ? "記録なし" : WORK_TRIGGER_TEXT[run.trigger]}
            </Fact>
            <Fact term="報告した人">
              {run.agent_id === null
                ? `アカウント ${run.reporter_account_id.slice(0, 8)}`
                : `agent ${run.agent_id.slice(0, 8)}`}
            </Fact>
            <Fact term="AIの利用">
              {run.ai_assisted
                ? `あり${run.tool_label === null ? "" : `（${run.tool_label}）`}`
                : "なし"}
            </Fact>
            <Fact term="運用の責任者">{employeeName(directory, run.owner_employee_id)}</Fact>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>対象と成果物</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {run.references.length === 0 ? (
            <p>対象は記録されていません。</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>種類</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {run.references.map((reference) => {
                  const link = REFERENCE_LINKS[reference.kind]
                  return (
                    <TableRow key={`${reference.kind}:${reference.id}`}>
                      <TableCell>{reference.kind}</TableCell>
                      <TableCell className="break-all whitespace-normal">
                        {link === undefined ? (
                          reference.id
                        ) : (
                          <Link href={link(reference.id)} className="underline underline-offset-4">
                            {reference.id}
                          </Link>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}

function Fact(props: { term: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{props.term}</dt>
      <dd className="break-words">{props.children}</dd>
    </div>
  )
}
