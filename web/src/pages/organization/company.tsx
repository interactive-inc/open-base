import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Loaded, PageHeader } from "@/components/app/data-view"
import { PeriodBadge } from "@/components/app/organization-period"
import {
  formatPeriod,
  todayOnCompanyCalendar,
  type OrganizationProfile,
} from "@/components/app/organization-types"
import { useApiJson } from "@/components/app/use-api-json"
import type { Props } from "./company.server"

type CompanyProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

/** 会社の基本情報。今の版を見せる。 */
export default function CompanyProfilePage({ initial }: CompanyProps) {
  const company = useApiJson<OrganizationProfile>("/company/organization-profile", initial?.company)

  return (
    <>
      <PageHeader
        title="会社の情報"
        description="会社の名前、代表者、期初の月などです。変更は CLI か MCP で新しい版として記録します。"
      />
      <Loaded state={company} fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
        {(current) => (
          <section aria-labelledby="company-now">
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 id="company-now">今の版</h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <dt className="text-muted-foreground">会社の名前</dt>
                  <dd className="break-words">{current.name}</dd>
                  <dt className="text-muted-foreground">代表者</dt>
                  <dd className="break-words">{current.representativeName}</dd>
                  <dt className="text-muted-foreground">期初の月</dt>
                  <dd>{current.fiscalYearStartMonth}月</dd>
                  <dt className="text-muted-foreground">言語と地域</dt>
                  <dd>{current.locale}</dd>
                  <dt className="text-muted-foreground">時間帯</dt>
                  <dd>{current.timeZone}</dd>
                  <dt className="text-muted-foreground">有効期間</dt>
                  <dd className="flex flex-wrap items-center gap-2">
                    {formatPeriod(current.version.effectiveOn, current.version.effectiveTo)}
                    <PeriodBadge
                      from={current.version.effectiveOn}
                      to={current.version.effectiveTo}
                      on={todayOnCompanyCalendar()}
                    />
                  </dd>
                  <dt className="text-muted-foreground">版</dt>
                  <dd>
                    情報の版 {current.version.resourceRevision} · 会社の版{" "}
                    {current.version.organizationRevision}
                  </dd>
                </dl>
              </CardContent>
            </Card>
          </section>
        )}
      </Loaded>
    </>
  )
}
