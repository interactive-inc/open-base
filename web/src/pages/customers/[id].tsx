import { BriefcaseIcon } from "lucide-react"
import type { ReactNode } from "react"
import type { CurrentProfile } from "@/components/app/app-shell"
import {
  FeatureDisabled,
  FeatureGate,
  isFeatureDisabled,
  useFeatures,
} from "@/components/app/business-feature"
import { employeeName, useEmployeeDirectory } from "@/components/app/business-directory"
import { RevisionHistory } from "@/components/app/business-history"
import { ProjectList } from "@/components/app/business-project-list"
import { CatalogStatusLabel } from "@/components/app/business-status"
import {
  CATALOG_STATUS_TEXT,
  countByProjectStatus,
  PROJECT_STATUS_TEXT,
  PROJECT_STATUSES,
  type CustomerRecord,
  type ProjectRecord,
  type RecordPage,
} from "@/components/app/business-types"
import { BackLink, EmptyState, Loaded, PageHeader, RowsSkeleton } from "@/components/app/data-view"
import { useApiJson } from "@/components/app/use-api-json"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Props } from "./[id].server"

type DetailProps = Omit<Props, "initial"> & { initial?: Props["initial"] }

type Initial = NonNullable<Props["initial"]>

/** 顧客の一件。その顧客の案件を段階ごとに並べ、顧客の変更の履歴を見せる。 */
export default function CustomerDetailPage({ email, pathname, id, initial }: DetailProps) {
  const profile = useApiJson<CurrentProfile>("/company/current-profile", initial?.profile)
  const features = useFeatures(initial?.features)

  return (
    <>
      <BackLink href="/customers">顧客の一覧</BackLink>
      <FeatureGate
        features={features}
        feature="customer"
        name="顧客"
        fallback={<Skeleton className="h-64 w-full" />}
      >
        <CustomerBody
          id={id}
          initial={initial}
          projectsEnabled={!isFeatureDisabled(features, "client-project")}
        />
      </FeatureGate>
    </>
  )
}

function CustomerBody(props: {
  id: string
  initial: Initial | undefined
  projectsEnabled: boolean
}) {
  const customer = useApiJson<RecordPage<CustomerRecord>>(
    `/customer/records?id=${props.id}`,
    props.initial?.customer ?? undefined,
  )

  return (
    <Loaded state={customer} fallback={<Skeleton className="h-64 w-full" />}>
      {(page) => {
        const record = page.data[0]
        if (record === undefined) {
          return (
            <Alert role="status">
              <AlertDescription>
                この顧客は見つかりません。一覧から選び直してください。
              </AlertDescription>
            </Alert>
          )
        }
        return (
          <Customer
            customer={record}
            projects={
              props.projectsEnabled ? (
                <CustomerProjects id={record.id} initial={props.initial?.projects ?? undefined} />
              ) : (
                <FeatureDisabled name="案件" />
              )
            }
          />
        )
      }}
    </Loaded>
  )
}

function Customer(props: { customer: CustomerRecord; projects: ReactNode }) {
  const { customer } = props

  return (
    <>
      <PageHeader
        title={customer.name}
        description={
          customer.aliases.length > 0 ? `別名 ${customer.aliases.join("、")}` : undefined
        }
        badges={<CatalogStatusLabel status={customer.status} />}
      />

      {props.projects}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>変更の履歴</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerHistory id={customer.id} />
        </CardContent>
      </Card>
    </>
  )
}

/** その顧客の案件。段階ごとの件数と、一件ごとの段階を見せる。 */
function CustomerProjects(props: { id: string; initial: Initial["projects"] | undefined }) {
  const projects = useApiJson<RecordPage<ProjectRecord>>(
    `/client-project/records?kind=project&customer_id=${props.id}&limit=100`,
    props.initial ?? undefined,
  )
  const directory = useEmployeeDirectory()

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-base font-medium">この顧客の案件</h2>
      <Loaded state={projects} fallback={<RowsSkeleton />}>
        {(page) => {
          if (page.data.length === 0) {
            return (
              <EmptyState
                icon={BriefcaseIcon}
                title="この顧客の案件はまだありません"
                description="CLI か MCP で案件を登録すると、ここに出ます。"
              />
            )
          }
          const counts = countByProjectStatus(page.data)
          return (
            <>
              <p className="text-sm">
                {PROJECT_STATUSES.map(
                  (status) => `${PROJECT_STATUS_TEXT[status]} ${counts[status]}件`,
                ).join(" · ")}
              </p>
              <ProjectList projects={page.data} ownerName={(id) => employeeName(directory, id)} />
            </>
          )
        }}
      </Loaded>
    </section>
  )
}

function CustomerHistory({ id }: { id: string }) {
  const history = useApiJson<RecordPage<CustomerRecord>>(
    `/customer/records?id=${id}&history=true&limit=100`,
  )

  return (
    <Loaded state={history} fallback={<Skeleton className="h-16 w-full" />}>
      {(page) => (
        <RevisionHistory
          entries={page.data.map((item) => ({
            revision: item.revision,
            recorded_at: item.recorded_at,
            reason: item.reason,
            summary: `${item.name} · ${CATALOG_STATUS_TEXT[item.status]}`,
          }))}
        />
      )}
    </Loaded>
  )
}
