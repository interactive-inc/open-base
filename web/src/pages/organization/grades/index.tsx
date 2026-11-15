import { LayersIcon } from "lucide-react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loaded, PageHeader } from "@/components/app/data-view"
import { useCompanyJson } from "@/components/app/organization-api"
import { AsOfPicker, PeriodBadge } from "@/components/app/organization-period"
import {
  formatPeriod,
  todayOnCompanyCalendar,
  type CompanyResource,
  type CompanyResourceList,
  type GradeAttributes,
} from "@/components/app/organization-types"
import type { Props } from "./index.server"

type GradesProps = Omit<Props, "initial"> & { initial?: Props["initial"] }
type Grade = CompanyResource<GradeAttributes>

/** 等級の定義。今の定義と予約中の定義を並べる。 */
export default function Grades({ organizationId }: GradesProps) {
  const today = todayOnCompanyCalendar()
  const [asOf, setAsOf] = useState("")
  const pastMode = asOf !== "" && asOf !== today
  const grades = useCompanyJson<CompanyResourceList>(
    `/company/definitions?type=grade${pastMode ? `&effective_on=${asOf}` : ""}`,
    organizationId,
  )

  return (
    <>
      <PageHeader
        title="等級"
        description="等級の定義です。変更は新しい版として記録され、前の版は履歴に残ります。"
      />
      <section aria-labelledby="grade-definitions">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 id="grade-definitions">等級の定義</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AsOfPicker
              value={asOf}
              today={today}
              onChange={setAsOf}
              description="選んだ日に有効だった等級を表示します。空なら予約中の等級も表示します。"
            />
            <Separator />
            <Loaded state={grades} fallback={<Skeleton className="h-48 w-full" />}>
              {(list) => {
                const items = (list.resources as Grade[]).toSorted(
                  (left, right) =>
                    (left.attributes.rank ?? Number.MAX_SAFE_INTEGER) -
                      (right.attributes.rank ?? Number.MAX_SAFE_INTEGER) ||
                    left.attributes.code.localeCompare(right.attributes.code),
                )
                return items.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <LayersIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {pastMode ? "この日に有効な等級はありません" : "等級がまだありません"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {pastMode
                          ? "別の日を選んでください。"
                          : "CLI か MCP で等級を登録すると、ここに出ます。"}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>等級</TableHead>
                        <TableHead>コード</TableHead>
                        <TableHead className="text-right">序列</TableHead>
                        <TableHead className="text-right">版</TableHead>
                        <TableHead>有効期間</TableHead>
                        <TableHead>状態</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((grade) => (
                        <GradeRow
                          key={`${grade.id}-${grade.revision}`}
                          grade={grade}
                          on={pastMode ? asOf : today}
                        />
                      ))}
                    </TableBody>
                  </Table>
                )
              }}
            </Loaded>
          </CardContent>
        </Card>
      </section>
    </>
  )
}

function GradeRow(props: { grade: Grade; on: string }) {
  const { grade } = props

  return (
    <TableRow>
      <TableCell className="whitespace-normal">
        <span className="flex flex-col gap-1">
          <span className="font-medium break-words">{grade.attributes.officialName}</span>
          {grade.attributes.description != null && (
            <span className="break-words">{grade.attributes.description}</span>
          )}
        </span>
      </TableCell>
      <TableCell>{grade.attributes.code}</TableCell>
      <TableCell className="text-right tabular-nums">{grade.attributes.rank ?? ""}</TableCell>
      <TableCell className="text-right tabular-nums">{grade.revision}</TableCell>
      <TableCell>{formatPeriod(grade.effectiveFrom, grade.effectiveTo)}</TableCell>
      <TableCell>
        <PeriodBadge from={grade.effectiveFrom} to={grade.effectiveTo} on={props.on} />
      </TableCell>
    </TableRow>
  )
}
