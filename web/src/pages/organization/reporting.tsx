import { ListChecksIcon, ShieldAlertIcon, UserSearchIcon } from "lucide-react"
import { Link } from "@void/react"
import { useState, type FormEvent } from "react"
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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useCompanyJson } from "@/components/app/organization-api"
import { EmployeeLookup } from "@/components/app/organization-employee-lookup"
import {
  formatCalendarDate,
  todayOnCompanyCalendar,
  type AuthorityResolution,
  type CompanyResourceList,
  type OrganizationUnit,
  type ReportingNode,
} from "@/components/app/organization-types"
import { sendApiJson, useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./reporting.server"

type ReportingProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

const NO_SCOPE = " none"
/** 上へたどった段の深さを字下げで見せる。 */
const INDENT = ["", "ms-4", "ms-8", "ms-12", "ms-16"]

const HOLDER: Readonly<Record<string, string>> = {
  employee: "本人として",
  "organizational-office": "役職として",
  "collective-body": "合議体の一員として",
}

const RULE: Readonly<Record<string, string>> = {
  unanimity: "全員一致",
  majority: "過半数",
  "qualified-majority": "特別多数",
}

/** 報告ラインと、会社上の判断資格の解決。権限の設定ではなく、会社の責務から誰が判断できるかを確かめる。 */
export default function Reporting(props: ReportingProps) {
  const { organizationId, initial } = props
  const units = useApiJson<OrganizationUnit[]>("/company/organization-units", initial?.units)
  const [employeeCode, setEmployeeCode] = useState(props.employeeCode)
  const [subject, setSubject] = useState("")

  return (
    <>
      <PageHeader
        title="報告ラインと判断資格"
        description="誰が誰の上長かと、ある判断を会社の責務の上で誰ができるかを確かめます。"
      />

      <section aria-labelledby="reporting-line">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="reporting-line">報告ライン</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <EmployeeLookup
              value={employeeCode}
              description="本人から上へたどった上長を表示します。"
              onSubmit={setEmployeeCode}
            />
            <Separator />
            {employeeCode === null ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <UserSearchIcon />
                  </EmptyMedia>
                  <EmptyTitle>従業員を選んでください</EmptyTitle>
                  <EmptyDescription>
                    従業員番号を入れると、その人の上長を順に表示します。
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Chain key={employeeCode} code={employeeCode} onUseAsSubject={setSubject} />
            )}
          </CardContent>
        </Card>
      </section>

      <AuthorityCheck
        organizationId={organizationId}
        units={units.kind === "ok" ? units.data : []}
        subject={subject}
        onSubjectChange={setSubject}
      />
    </>
  )
}

function depthLabel(depth: number) {
  if (depth === 0) return "本人"
  if (depth === 1) return "直属の上長"
  return `${depth}段上の上長`
}

function Chain(props: { code: string; onUseAsSubject: (employeeId: string) => void }) {
  const line = useApiJson<ReportingNode[]>(
    `/company/reporting-lines/${encodeURIComponent(props.code)}`,
  )
  return (
    <Loaded state={line} fallback={<RowsSkeleton rows={3} />}>
      {(nodes) => {
        const depths = [...new Set(nodes.map((node) => node.depth))].toSorted((a, b) => a - b)
        return (
          <ol className="flex flex-col gap-4">
            {depths.map((depth) => (
              <li
                key={depth}
                className={`flex flex-col gap-2 ${INDENT[Math.min(depth, INDENT.length - 1)]}`}
              >
                <span className="text-xs text-muted-foreground">{depthLabel(depth)}</span>
                <ul className="flex flex-col gap-2">
                  {nodes
                    .filter((node) => node.depth === depth)
                    .map((node) => (
                      <li key={node.employee_id}>
                        <Item variant="muted" size="sm">
                          <ItemContent>
                            <ItemTitle>{node.employee_name}</ItemTitle>
                            <ItemDescription>
                              {node.employee_code ?? "番号なし"}
                              {node.department_code !== null && ` · ${node.department_code}`}
                              {node.position !== null && ` · ${node.position}`}
                            </ItemDescription>
                          </ItemContent>
                          {depth === 0 && (
                            <ItemActions className="flex-wrap">
                              {node.employee_code !== null && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  render={
                                    <Link
                                      href={`/organization/grades/assignments?employee=${encodeURIComponent(node.employee_code)}`}
                                    />
                                  }
                                >
                                  等級を見る
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => props.onUseAsSubject(node.employee_id)}
                              >
                                判断の対象にする
                              </Button>
                            </ItemActions>
                          )}
                        </Item>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
            {nodes.length === 1 && <li>上長は登録されていません。</li>}
          </ol>
        )
      }}
    </Loaded>
  )
}

function AuthorityCheck(props: {
  organizationId: string
  units: ReadonlyArray<OrganizationUnit>
  subject: string
  onSubjectChange: (value: string) => void
}) {
  const definitions = useCompanyJson<CompanyResourceList>(
    "/company/definitions",
    props.organizationId,
  )
  const responsibilities =
    definitions.kind === "ok"
      ? definitions.data.resources
          .filter((item) => item.type === "responsibility")
          .map((item) => ({
            value: String(item.attributes.code),
            label: `${String(item.attributes.officialName)}（${String(item.attributes.code)}）`,
          }))
      : []
  const scopes = [
    { value: NO_SCOPE, label: "指定しない" },
    ...props.units.map((unit) => ({ value: unit.id, label: `${unit.name}（${unit.code}）` })),
  ]
  const [asOf, setAsOf] = useState(todayOnCompanyCalendar())
  const [responsibility, setResponsibility] = useState<string | null>(null)
  const [scope, setScope] = useState(NO_SCOPE)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AuthorityResolution | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (asOf === "" || responsibility === null) {
      setError("基準日と責務を選んでください。")
      return
    }
    setSending(true)
    setError(null)
    setResult(null)
    // 読み取りの照会なので冪等キーは要らない。組織IDのヘッダーだけを付ける。
    const response = await sendApiJson<AuthorityResolution>(
      "POST",
      "/company/authority-resolutions",
      {
        as_of: asOf,
        subject_employee_id: props.subject.trim() === "" ? null : props.subject.trim(),
        criteria: [
          {
            responsibility_code: responsibility,
            scope: scope === NO_SCOPE ? null : { scope_type: "organization-unit", scope_id: scope },
          },
        ],
      },
      { "x-company-organization-id": props.organizationId },
    )
    setSending(false)
    if (response.kind === "error") {
      setError(response.message)
      return
    }
    setResult(response.data)
  }

  const ready = definitions.kind === "ok" && responsibilities.length > 0

  return (
    <>
      <section aria-labelledby="authority">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="authority">判断資格の確認</h2>
            </CardTitle>
          </CardHeader>
          {ready ? (
            <form onSubmit={submit} className="contents">
              <CardContent className="flex flex-col gap-4">
                <p>
                  会社の責務と範囲から、その日に判断できる人を求めます。候補がいないときは、誰も判断できない扱いになります。
                </p>
                <FieldGroup className="max-w-xl">
                  <Field name="asOf" className="max-w-56">
                    <FieldLabel>基準日</FieldLabel>
                    <Input type="date" value={asOf} onValueChange={setAsOf} />
                  </Field>
                  <Field name="responsibility">
                    <FieldLabel>責務</FieldLabel>
                    <Select
                      items={responsibilities}
                      value={responsibility}
                      onValueChange={(value) =>
                        setResponsibility(typeof value === "string" ? value : null)
                      }
                      placeholder="選んでください"
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {responsibilities.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field name="scope">
                    <FieldLabel>範囲の組織単位</FieldLabel>
                    <Select
                      items={scopes}
                      value={scope}
                      onValueChange={(value) =>
                        setScope(typeof value === "string" ? value : NO_SCOPE)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {scopes.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field name="subject">
                    <FieldLabel>判断される人の従業員ID</FieldLabel>
                    <Input
                      value={props.subject}
                      onValueChange={props.onSubjectChange}
                      maxLength={255}
                    />
                    <FieldDescription>
                      任意です。本人は候補から外れます。報告ラインの「判断の対象にする」でも入ります。
                    </FieldDescription>
                  </Field>
                </FieldGroup>
                {error !== null && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="justify-end">
                <Button type="submit" disabled={sending}>
                  判断できる人を求める
                </Button>
              </CardFooter>
            </form>
          ) : (
            <CardContent>
              <Loaded state={definitions} fallback={<RowsSkeleton rows={2} />}>
                {() => (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ListChecksIcon />
                      </EmptyMedia>
                      <EmptyTitle>責務の定義がまだありません</EmptyTitle>
                      <EmptyDescription>
                        CLI か MCP で責務を定義すると、ここで判断できる人を確かめられます。
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                )}
              </Loaded>
            </CardContent>
          )}
        </Card>
      </section>
      {result !== null && <ResolutionResult result={result} />}
    </>
  )
}

function ResolutionResult({ result }: { result: AuthorityResolution }) {
  return (
    <section aria-labelledby="authority-result">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="authority-result">判断できる人</h2>
          </CardTitle>
          <CardDescription>
            {formatCalendarDate(result.snapshot.asOf)}時点 · 会社の版{" "}
            {result.snapshot.organizationRevision}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {result.candidates.length === 0 ? (
            <Alert variant="destructive" role="status">
              <ShieldAlertIcon aria-hidden="true" />
              <AlertDescription>
                この条件で判断できる人はいません。安全のため、この判断は受け付けられません。
              </AlertDescription>
            </Alert>
          ) : (
            <ul className="flex flex-col">
              {result.candidates.map((candidate, index) => (
                <li key={candidate.employeeId}>
                  {index > 0 && <ItemSeparator />}
                  <Item size="sm">
                    <ItemContent>
                      <ItemTitle>従業員 {candidate.employeeId}</ItemTitle>
                      <ItemDescription>アカウント {candidate.accountId}</ItemDescription>
                      <ul className="flex flex-col gap-1">
                        {candidate.qualifications.map((qualification, qualificationIndex) => (
                          <li key={qualificationIndex}>
                            {HOLDER[qualification.holderType] ?? qualification.holderType}
                            {qualification.delegationAllowed ? " · 委任できる" : " · 委任できない"}
                            {qualification.collectiveDecision !== null &&
                              ` · ${qualification.collectiveDecision.votingMemberCount}人中${qualification.collectiveDecision.quorumRequired}人の出席、${RULE[qualification.collectiveDecision.decisionRule] ?? qualification.collectiveDecision.decisionRule}で決める`}
                          </li>
                        ))}
                      </ul>
                    </ItemContent>
                  </Item>
                </li>
              ))}
            </ul>
          )}
          {result.exclusions.length > 0 && (
            <p>
              判断される本人のため外した人:{" "}
              {result.exclusions.map((item) => item.employeeId).join("、")}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
