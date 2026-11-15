import { Link } from "@void/react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Timeline,
  TimelineConnector,
  TimelineDescription,
  TimelineItem,
  TimelineMarker,
  TimelineTime,
  TimelineTitle,
} from "@/components/ui/timeline"
import { BackLink, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useCompanyJson } from "@/components/app/organization-api"
import { AsOfPicker, ChangeMark, PeriodBadge } from "@/components/app/organization-period"
import {
  formatCalendarDate,
  formatPeriod,
  formatRecordedAt,
  todayOnCompanyCalendar,
  UNIT_KIND_LABEL,
  type CompanyResourceHistory,
  type CompanyResourceList,
  type OrganizationMember,
  type OrganizationUnit,
  type OrganizationUnitAttributes,
} from "@/components/app/organization-types"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./[code].server"

type UnitProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 組織単位の一件。今の姿、所属する人、変更の履歴、過去の姿を見せる。 */
export default function OrganizationUnitPage(props: UnitProps) {
  const { organizationId, code, initial } = props
  const encoded = encodeURIComponent(code)
  const unit = useApiJson<OrganizationUnit>(`/company/organization-units/${encoded}`, initial?.unit)
  const units = useApiJson<OrganizationUnit[]>("/company/organization-units", initial?.units)
  const members = useApiJson<OrganizationMember[]>(
    `/company/organization-units/${encoded}/members`,
    initial?.members,
  )

  return (
    <>
      <BackLink href="/organization">組織図</BackLink>

      <Loaded state={unit} fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        {(current) => (
          <Detail
            key={`${current.code}-${current.organization_revision}`}
            unit={current}
            units={units.kind === "ok" ? units.data : []}
            members={members}
            organizationId={organizationId}
          />
        )}
      </Loaded>
    </>
  )
}

function Detail(props: {
  unit: OrganizationUnit
  units: ReadonlyArray<OrganizationUnit>
  members: ReturnType<typeof useApiJson<OrganizationMember[]>>
  organizationId: string
}) {
  const { unit } = props
  const nameByCode = new Map(props.units.map((item) => [item.code, item.name]))
  const parentName =
    unit.parent_code === null
      ? "なし（最上位）"
      : (nameByCode.get(unit.parent_code) ?? unit.parent_code)
  // 変更の履歴は資源のIDで引く。組織単位のIDと資源のIDの対応は今のsnapshotで確かめる。
  const snapshot = useCompanyJson<CompanyResourceList>(
    "/company/organization-snapshots",
    props.organizationId,
  )
  const resource =
    snapshot.kind === "ok"
      ? snapshot.data.resources.find(
          (item) =>
            item.type === "organization-unit" &&
            (item.attributes as OrganizationUnitAttributes).organizationUnitId === unit.id,
        )
      : undefined

  return (
    <>
      <PageHeader
        title={<span className="break-words">{unit.name}</span>}
        description="組織単位の今の姿、所属する人、変更の履歴です。過去の日を選ぶと、その日の姿と比べられます。"
        badges={
          <>
            <Badge variant="outline">コード {unit.code}</Badge>
            <Badge variant="outline">{formatCalendarDate(unit.as_of)}時点</Badge>
            <Badge variant="outline">会社の版 {unit.organization_revision}</Badge>
          </>
        }
      />

      <section aria-labelledby="unit-now">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="unit-now">今の姿</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
              <dt className="text-muted-foreground">名前</dt>
              <dd className="break-words">{unit.name}</dd>
              <dt className="text-muted-foreground">上位の組織単位</dt>
              <dd>
                {unit.parent_code === null ? (
                  parentName
                ) : (
                  <Link href={`/organization/units/${encodeURIComponent(unit.parent_code)}`}>
                    {parentName}
                  </Link>
                )}
              </dd>
              <dt className="text-muted-foreground">責任者</dt>
              <dd>{unit.manager_employee_code ?? "未設定"}</dd>
              {resource !== undefined && (
                <>
                  <dt className="text-muted-foreground">種類</dt>
                  <dd>
                    {UNIT_KIND_LABEL[(resource.attributes as OrganizationUnitAttributes).kind]}
                  </dd>
                  <dt className="text-muted-foreground">有効期間</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    {formatPeriod(resource.effectiveFrom, resource.effectiveTo)}
                    <PeriodBadge
                      from={resource.effectiveFrom}
                      to={resource.effectiveTo}
                      on={todayOnCompanyCalendar()}
                    />
                  </dd>
                </>
              )}
            </dl>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="unit-members">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="unit-members">所属する人</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Loaded state={props.members} fallback={<RowsSkeleton rows={2} />}>
              {(list) =>
                list.length === 0 ? (
                  <p>所属する人はいません。</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>名前</TableHead>
                        <TableHead>従業員番号</TableHead>
                        <TableHead>役職</TableHead>
                        <TableHead>上長</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((member) => (
                        <TableRow key={member.employee_code}>
                          <TableCell>
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{member.employee_name}</span>
                              {member.is_manager && <Badge variant="secondary">責任者</Badge>}
                            </span>
                          </TableCell>
                          <TableCell>{member.employee_code}</TableCell>
                          <TableCell>{member.position ?? ""}</TableCell>
                          <TableCell>{member.manager_employee_code ?? ""}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )
              }
            </Loaded>
          </CardContent>
        </Card>
      </section>

      <History
        resourceId={resource?.id ?? (snapshot.kind === "loading" ? null : unit.id)}
        organizationId={props.organizationId}
        nameById={
          new Map(
            snapshot.kind === "ok"
              ? snapshot.data.resources
                  .filter((item) => item.type === "organization-unit")
                  .map((item) => {
                    const attributes = item.attributes as OrganizationUnitAttributes
                    return [attributes.organizationUnitId, attributes.officialName] as const
                  })
              : [],
          )
        }
      />

      <PastView unit={unit} organizationId={props.organizationId} nameByCode={nameByCode} />
    </>
  )
}

/** 組織単位の版の並び。新しい版を上にし、前の版から何が変わったかを札で見せる。 */
function History(props: {
  resourceId: string | null
  organizationId: string
  nameById: ReadonlyMap<string, string>
}) {
  const history = useCompanyJson<CompanyResourceHistory<OrganizationUnitAttributes>>(
    props.resourceId === null
      ? null
      : `/company/resource-history/organization-unit/${encodeURIComponent(props.resourceId)}?limit=100`,
    props.organizationId,
  )

  return (
    <section aria-labelledby="unit-history">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="unit-history">変更の履歴</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Loaded state={history} fallback={<RowsSkeleton rows={2} />}>
            {(page) => {
              if (page.data.length === 0) return <p>記録はまだありません。</p>
              const latest = page.data.at(-1)!.resource.revision
              return (
                <Timeline aria-label="組織単位の版">
                  {page.data
                    .map((entry, index) => ({ entry, previous: page.data[index - 1] }))
                    .reverse()
                    .map(({ entry, previous }) => {
                      const now = entry.resource.attributes
                      const before = previous?.resource.attributes
                      const parent =
                        now.parentOrganizationUnitId === null
                          ? "なし（最上位）"
                          : (props.nameById.get(now.parentOrganizationUnitId) ??
                            now.parentOrganizationUnitId)
                      const isLatest = entry.resource.revision === latest
                      return (
                        <TimelineItem
                          key={entry.resource.revision}
                          value={String(entry.resource.revision)}
                          status={isLatest ? "current" : "complete"}
                        >
                          <TimelineMarker />
                          <TimelineConnector />
                          <TimelineTitle className="flex flex-wrap items-center gap-2">
                            版 {entry.resource.revision}
                            {isLatest && <Badge variant="secondary">最新の版</Badge>}
                            {entry.change.state === "void" && <ChangeMark>廃止</ChangeMark>}
                            {before !== undefined && before.officialName !== now.officialName && (
                              <ChangeMark>名前を変更</ChangeMark>
                            )}
                            {before !== undefined &&
                              before.parentOrganizationUnitId !== now.parentOrganizationUnitId && (
                                <ChangeMark>上位を変更</ChangeMark>
                              )}
                            {entry.change.corrects_revision !== null && (
                              <ChangeMark>{`版 ${entry.change.corrects_revision} の訂正`}</ChangeMark>
                            )}
                          </TimelineTitle>
                          <TimelineTime dateTime={new Date(entry.change.recorded_at).toISOString()}>
                            記録 {formatRecordedAt(entry.change.recorded_at)}
                          </TimelineTime>
                          <TimelineDescription className="flex flex-col gap-1">
                            <span className="break-words text-foreground">
                              {now.officialName} · 上位 {parent}
                            </span>
                            <span>
                              {formatPeriod(
                                entry.resource.effectiveFrom,
                                entry.resource.effectiveTo,
                              )}
                            </span>
                            <span className="text-foreground">
                              理由: {entry.change.reason ?? "表示する権限がありません"}
                            </span>
                          </TimelineDescription>
                        </TimelineItem>
                      )
                    })}
                </Timeline>
              )
            }}
          </Loaded>
        </CardContent>
      </Card>
    </section>
  )
}

/** 基準日を選び、その日の姿と今の姿を並べて違いを見せる。 */
function PastView(props: {
  unit: OrganizationUnit
  organizationId: string
  nameByCode: ReadonlyMap<string, string>
}) {
  const today = todayOnCompanyCalendar()
  const [asOf, setAsOf] = useState("")
  const active = asOf !== "" && asOf !== today
  const snapshot = useCompanyJson<CompanyResourceList>(
    active ? `/company/organization-snapshots?effective_on=${asOf}` : null,
    props.organizationId,
  )

  return (
    <section aria-labelledby="unit-past">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 id="unit-past">過去の姿</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <AsOfPicker
            value={asOf}
            today={today}
            onChange={setAsOf}
            description="選んだ日のこの組織単位を、今と比べて表示します。"
          />
          {active && (
            <>
              <Separator />
              <Loaded state={snapshot} fallback={<Skeleton className="h-24 w-full" />}>
                {(data) => (
                  <Comparison
                    asOf={asOf}
                    unit={props.unit}
                    nameByCode={props.nameByCode}
                    units={data.resources
                      .filter((item) => item.type === "organization-unit")
                      .map((item) => item.attributes as OrganizationUnitAttributes)}
                  />
                )}
              </Loaded>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

/** 基準日の姿と今の姿を項目ごとに並べ、変わった項目に印を付ける。 */
function Comparison(props: {
  asOf: string
  unit: OrganizationUnit
  nameByCode: ReadonlyMap<string, string>
  units: ReadonlyArray<OrganizationUnitAttributes>
}) {
  const then = props.units.find((item) => item.organizationUnitId === props.unit.id)
  if (then === undefined) return <p>この日には、この組織単位はまだありませんでした。</p>
  const parentThen =
    then.parentOrganizationUnitId === null
      ? null
      : (props.units.find((item) => item.organizationUnitId === then.parentOrganizationUnitId) ??
        null)
  const parentNow =
    props.unit.parent_code === null
      ? "なし（最上位）"
      : (props.nameByCode.get(props.unit.parent_code) ?? props.unit.parent_code)
  const rows = [
    {
      label: "名前",
      past: then.officialName,
      now: props.unit.name,
      differs: then.officialName !== props.unit.name,
    },
    {
      label: "上位の組織単位",
      past: parentThen === null ? "なし（最上位）" : parentThen.officialName,
      now: parentNow,
      differs: (parentThen?.code ?? null) !== props.unit.parent_code,
    },
  ]

  return (
    <Table>
      <TableCaption className="sr-only">基準日と今の比較</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>項目</TableHead>
          <TableHead>{formatCalendarDate(props.asOf)}</TableHead>
          <TableHead>今</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableHead scope="row" className="font-normal">
              {row.label}
            </TableHead>
            <TableCell className="whitespace-normal break-words">{row.past}</TableCell>
            <TableCell className="whitespace-normal break-words">
              <span className="flex flex-wrap items-center gap-2">
                {row.now}
                {row.differs && <ChangeMark>変わった</ChangeMark>}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
