import { CalendarRange } from "lucide-react"
import { Link } from "@void/react"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  BackLink,
  EmptyState,
  formatDate,
  Loaded,
  PageHeader,
  RowsSkeleton,
} from "@/components/app/data-view"
import { formatPeriod } from "@/components/app/reviews-model"
import { reviewApi } from "@/components/app/reviews-paths"
import type { ReviewCycle, ReviewPage } from "@/components/app/reviews-types"
import { useApiJson } from "@/components/app/use-api-json"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Props } from "./index.server"

type CyclesProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 評価期間の一覧。期間ごとに、評価の尺度と二つの承認経路が固定される。 */
export default function ReviewCycles({ email, pathname, initial }: CyclesProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const cycles = useApiJson<ReviewPage<ReviewCycle>>(reviewApi.cycles, initial?.cycles)

  return (
    <>
      <BackLink href="/reviews">評価の一覧</BackLink>
      <PageHeader
        title="評価期間"
        description="評価シートは期間ごとに作ります。尺度と承認の経路は期間を作ったときに決まります。"
      />

      <Loaded state={cycles} fallback={<RowsSkeleton />}>
        {(page) =>
          page.data.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="まだ評価期間がありません"
              description="CLI か MCP で評価期間を登録すると、ここに出ます。"
            />
          ) : (
            <ul className="flex flex-col gap-4">
              {page.data.map((cycle) => (
                <li key={cycle.id}>
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle>
                        <h2 className="break-words">
                          <Link href={`/reviews/cycles/${cycle.id}`}>{cycle.name}</Link>
                        </h2>
                      </CardTitle>
                      <CardDescription>
                        <span>{formatPeriod(cycle.starts_on, cycle.ends_on)}</span> · 作成{" "}
                        {formatDate(cycle.created_at)}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </Loaded>
    </>
  )
}
