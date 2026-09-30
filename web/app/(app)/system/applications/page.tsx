import { notFound } from "next/navigation"
import Link from "next/link"
import { Suspense } from "react"
import { AdminApplicationsFilterForm } from "@/app/(app)/system/applications/_components/admin-applications-filter-form"
import { AdminApplicationsTable } from "@/app/(app)/system/applications/_components/admin-applications-table"
import { FetchError } from "@/components/fetch-error"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { TablePagination } from "@/components/table-pagination"
import { PAGE_SIZE_OPTIONS, parsePageSize } from "@/lib/pagination/parse-page-size"
import { Button } from "@/components/ui/button"
import { getApplicationTemplates } from "@/lib/api/get-application-templates"
import {
  getApplicationAdminList,
  type ApplicationAdminFilter,
  type ApplicationAdminSort,
} from "@/lib/api/get-application-admin-list"
import { getMe } from "@/lib/api/get-me"
import { canViewAllApplications } from "@/lib/application/can-view-all-applications"
import { canManageWorkflowRepairs } from "@/lib/application/can-manage-workflow-repairs"
import type { ApplicationStatus } from "@/lib/api/types/application-types"

export const metadata = { title: "全社の申請" }

const SORT_VALUES: ReadonlyArray<ApplicationAdminSort> = ["created_at_desc", "created_at_asc"]

type SearchParams = Promise<{ [key: string]: string | Array<string> | undefined }>

/**
 * 全社の申請を横断で管理する画面。application:read:all を持つロールのみ表示できる。
 * フィルタ(ステータス/テンプレート/申請者/期間)と並び替えを searchParams に持ち、
 * リロードや共有 URL でも同じ結果を再現できる。
 */
export default async function AdminApplicationsPage(props: { searchParams: SearchParams }) {
  const currentUser = await getMe()

  if (currentUser instanceof Error || canViewAllApplications(currentUser.permissions) === false) {
    notFound()
  }

  const canRepairWorkflows = canManageWorkflowRepairs(currentUser.permissions)

  const params = await props.searchParams

  const status = toStatus(toSingleValue(params.status))

  const templateCode = toSingleValue(params.template_code)

  const applicantIdRaw = toSingleValue(params.applicant_id)

  const applicantId = toApplicantId(applicantIdRaw)

  const from = toSingleValue(params.from)

  const to = toSingleValue(params.to)

  const pageSize = parsePageSize(toSingleValue(params.size) ?? undefined)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const sort = toSort(toSingleValue(params.sort))

  const filter: ApplicationAdminFilter = {
    status: status,
    applicantId: applicantId,
    templateCode: templateCode,
    from: from,
    to: to,
  }

  // 絞り込み条件が変わったら Suspense を張り替えて先読みキャッシュを分離する。
  const suspenseKey = [
    filter.status ?? "",
    filter.applicantId ?? "",
    filter.templateCode ?? "",
    filter.from ?? "",
    filter.to ?? "",
    sort,
    page,
  ].join(":")

  // ページングと並び替えでフィルタ状態を保つための共通パラメータ。
  const extraParams: Record<string, string | undefined> = {
    status: filter.status ?? undefined,
    template_code: filter.templateCode ?? undefined,
    applicant_id: filter.applicantId !== null ? String(filter.applicantId) : undefined,
    from: filter.from ?? undefined,
    to: filter.to ?? undefined,
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="全社の申請">
        {canRepairWorkflows ? (
          <Button
            variant="secondary"
            nativeButton={false}
            render={<Link href="/system/workflow-repairs" />}
          >
            ワークフロー修復
          </Button>
        ) : null}
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/inbox/applications" />}
        >
          承認 inbox
        </Button>
      </PageHeader>

      <Suspense
        fallback={<div className="h-9 animate-pulse rounded-md bg-muted" aria-hidden="true" />}
      >
        <FilterFormSection
          statusValue={filter.status ?? ""}
          templateCodeValue={filter.templateCode ?? ""}
          applicantIdValue={applicantIdRaw ?? ""}
          fromValue={filter.from ?? ""}
          toValue={filter.to ?? ""}
        />
      </Suspense>

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-12 w-full" />}>
        <AdminListSection
          filter={filter}
          offset={offset}
          pageSize={pageSize}
          sort={sort}
          extraParams={extraParams}
        />
      </Suspense>
    </div>
  )
}

async function FilterFormSection(props: {
  statusValue: "pending" | "approved" | "rejected" | ""
  templateCodeValue: string
  applicantIdValue: string
  fromValue: string
  toValue: string
}) {
  const templates = await getApplicationTemplates(null)

  const templateOptions = templates instanceof Error ? [] : templates

  return (
    <AdminApplicationsFilterForm
      statusValue={props.statusValue}
      templateCodeValue={props.templateCodeValue}
      applicantIdValue={props.applicantIdValue}
      fromValue={props.fromValue}
      toValue={props.toValue}
      templates={templateOptions}
    />
  )
}

async function AdminListSection(props: {
  filter: ApplicationAdminFilter
  offset: number
  pageSize: number
  sort: ApplicationAdminSort
  extraParams: Record<string, string | undefined>
}) {
  const result = await getApplicationAdminList(props.filter, {
    limit: props.pageSize,
    offset: props.offset,
    sort: props.sort,
  })

  if (result instanceof Error) {
    return <FetchError message="申請一覧の取得に失敗しました" />
  }

  const paginationExtraParams: Record<string, string | undefined> = {
    ...props.extraParams,
    sort: props.sort === "created_at_desc" ? undefined : props.sort,
    size: String(props.pageSize),
  }

  return (
    <div className="flex flex-col gap-4">
      <AdminApplicationsTable
        rows={result.data}
        total={result.total}
        currentSort={props.sort}
        extraParams={props.extraParams}
      />

      <TablePagination
        pathname="/system/applications"
        total={result.total}
        limit={props.pageSize}
        offset={props.offset}
        extraParams={paginationExtraParams}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </div>
  )
}

function toSingleValue(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  if (value === "") {
    return null
  }

  return value
}

function toStatus(value: string | null): ApplicationStatus | null {
  if (value === "pending" || value === "approved" || value === "rejected") {
    return value
  }

  return null
}

function toApplicantId(raw: string | null): string | null {
  return raw === null || raw.length > 128 ? null : raw
}

function toSort(raw: string | null): ApplicationAdminSort {
  if (raw !== null && (SORT_VALUES as ReadonlyArray<string>).includes(raw)) {
    return raw as ApplicationAdminSort
  }

  return "created_at_desc"
}
