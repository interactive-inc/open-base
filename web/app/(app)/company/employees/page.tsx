import { Suspense } from "react"
import { EmployeeListSection } from "@/app/(app)/company/employees/_components/employee-list-section"
import { EmployeeSearchForm } from "@/app/(app)/company/employees/_components/employee-search-form"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import { parsePageSize } from "@/lib/pagination/parse-page-size"
import type {
  EmployeeSearchFilter,
  EmployeeStatusFilter,
} from "@/lib/api/types/employee-search-filter"
import { requirePermission } from "@/lib/auth/require-permission"

export const metadata = { title: "従業員" }

type Props = {
  searchParams: Promise<{ [key: string]: string | Array<string> | undefined }>
}

/**
 * 従業員一覧画面。searchParams から絞り込み条件を組み立て、
 * フォーム + 非同期テーブルを Suspense 境界で描画する RSC。
 */
export default async function EmployeesPage(props: Props) {
  await requirePermission("employee:read")

  const params = await props.searchParams

  const filter = toFilter(params)

  const pageSize = parsePageSize(toSingleValue(params.size) ?? undefined)

  const rawPage = toSingleValue(params.page)

  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1)

  const offset = (page - 1) * pageSize

  const suspenseKey = `${filter.q ?? ""}:${filter.dept ?? ""}:${filter.status ?? ""}:${page}`

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="従業員" />

      <EmployeeSearchForm filter={filter} />

      <Suspense key={suspenseKey} fallback={<ListSkeleton rows={5} rowClassName="h-10 w-full" />}>
        <EmployeeListSection filter={filter} offset={offset} limit={pageSize} />
      </Suspense>
    </div>
  )
}

/** searchParams の生の値を EmployeeSearchFilter に正規化する。 */
function toFilter(params: {
  [key: string]: string | Array<string> | undefined
}): EmployeeSearchFilter {
  return {
    q: toSingleValue(params.q),
    dept: toSingleValue(params.dept),
    status: toStatus(params.status),
  }
}

/** 配列・未定義・空文字を null に潰した単一文字列を返す。 */
function toSingleValue(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") {
    return null
  }

  if (value === "") {
    return null
  }

  return value
}

/** status を許可された enum のみに絞り込む。範囲外は null。 */
function toStatus(value: string | Array<string> | undefined): EmployeeStatusFilter | null {
  if (value === "active") {
    return "active"
  }

  if (value === "leave") {
    return "leave"
  }

  if (value === "retired") {
    return "retired"
  }

  return null
}
