import { Bell, Building2, FileText, Inbox, Users } from "lucide-react"
import type { ComponentType, ReactNode } from "react"
import { AppShell, type CurrentProfile } from "@/components/app/app-shell"
import { useApiJson, type ApiJsonState } from "@/components/app/use-api-json"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { Props } from "./index.server"

type Dashboard = {
  employee_count: number
  pending_application_count: number
  department_breakdown: ReadonlyArray<{ dept_name: string; count: number }>
  application_trend: ReadonlyArray<{ month: string; count: number }>
}

export default function Home({ email, pathname }: Props) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile")
  const inbox = useApiJson<{ applications: number }>("/company/inbox/counts")
  const unread = useApiJson<{ unread_count: number }>("/system/notifications/unread-count")
  const canViewDashboard =
    profile.kind === "ok" && profile.data.permissions.includes("dashboard:view")

  return (
    <AppShell email={email} pathname={pathname} profile={profile}>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          {profile.kind === "ok" ? `${profile.data.name} さん` : "ダッシュボード"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.kind === "ok"
            ? [profile.data.dept_name, profile.data.position].filter(Boolean).join(" / ") ||
              "所属なし"
            : email}
        </p>
      </div>

      {profile.kind === "forbidden" && (
        <Alert>
          <AlertDescription>
            このアカウントはまだ従業員と結び付いていません。管理者に連携を依頼してください。
          </AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">自分の対応</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <MetricCard
            icon={Inbox}
            label="承認を待つ申請"
            state={inbox}
            value={(data) => data.applications}
          />
          <MetricCard
            icon={Bell}
            label="未読の通知"
            state={unread}
            value={(data) => data.unread_count}
          />
        </div>
      </section>

      {canViewDashboard && <CompanyOverview />}
    </AppShell>
  )
}

function CompanyOverview() {
  const dashboard = useApiJson<Dashboard>("/company/dashboard")

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium text-muted-foreground">会社の状況</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <MetricCard
          icon={Users}
          label="在籍している従業員"
          state={dashboard}
          value={(data) => data.employee_count}
        />
        <MetricCard
          icon={FileText}
          label="処理中の申請（全体）"
          state={dashboard}
          value={(data) => data.pending_application_count}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>部署ごとの人数</CardTitle>
            <CardDescription>在籍している従業員の主な所属で数えます。</CardDescription>
          </CardHeader>
          <CardContent>
            <Loaded state={dashboard}>
              {(data) =>
                data.department_breakdown.length === 0 ? (
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Building2 />
                      </EmptyMedia>
                      <EmptyTitle>部署がありません</EmptyTitle>
                      <EmptyDescription>組織を登録すると、ここに人数が出ます。</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <BarList
                    rows={[...data.department_breakdown]
                      .sort((a, b) => b.count - a.count)
                      .map((row) => ({ label: row.dept_name, value: row.count }))}
                  />
                )
              }
            </Loaded>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>申請の推移</CardTitle>
            <CardDescription>直近6か月に出された申請の数です。</CardDescription>
          </CardHeader>
          <CardContent>
            <Loaded state={dashboard}>
              {(data) => (
                <BarList
                  rows={data.application_trend.map((row) => ({
                    label: formatMonth(row.month),
                    value: row.count,
                  }))}
                />
              )}
            </Loaded>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function MetricCard<T>(props: {
  icon: ComponentType
  label: string
  state: ApiJsonState<T>
  value: (data: T) => number
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>
          <span className="flex items-center gap-2">
            <props.icon />
            {props.label}
          </span>
        </CardDescription>
        <CardTitle>
          <Loaded state={props.state} fallback={<SkeletonBox className="h-8 w-16" />}>
            {(data) => (
              <span className="text-3xl font-semibold tabular-nums">
                {props.value(data).toLocaleString("ja-JP")}
              </span>
            )}
          </Loaded>
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function Loaded<T>(props: {
  state: ApiJsonState<T>
  fallback?: ReactNode
  children: (data: T) => ReactNode
}) {
  if (props.state.kind === "ok") return <>{props.children(props.state.data)}</>
  if (props.state.kind === "loading")
    return <>{props.fallback ?? <SkeletonBox className="h-32 w-full" />}</>
  return (
    <span className="text-sm text-muted-foreground">
      {props.state.kind === "forbidden" ? "表示する権限がありません" : "読み込めませんでした"}
    </span>
  )
}

/** Skeletonの大きさは包むdivで決める。 */
function SkeletonBox({ className }: { className: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-full w-full" />
    </div>
  )
}

function BarList({ rows }: { rows: ReadonlyArray<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value))
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.label} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-2 text-sm">
          <span className="truncate text-muted-foreground">{row.label}</span>
          <span className="h-2 rounded-full bg-muted">
            <span
              className="block h-2 rounded-full bg-primary"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  )
}

function formatMonth(month: string): string {
  const [year, value] = month.split("-")
  return `${year}年${Number(value)}月`
}
