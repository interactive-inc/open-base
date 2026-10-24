import { Suspense } from "react"
import { CompanyEmployeeEventFilterForm } from "@/app/(app)/company/employee-events/_components/company-employee-event-filter-form"
import { CompanyEmployeeEventSection } from "@/app/(app)/company/employee-events/_components/company-employee-event-section"
import { EmptyState } from "@/components/empty-state"
import { ListSkeleton } from "@/components/list-skeleton"
import { PageHeader } from "@/components/page-header"
import type { EmployeeEventKind } from "@/lib/api/types/employee-event-types"
import { requireAnyPermission } from "@/lib/auth/require-any-permission"

export const metadata = { title: "雇用履歴" }

type Props = {
  searchParams: Promise<{ [key: string]: string | Array<string> | undefined }>
}

/**
 * 入社・異動・休職・復職・退職の記録を読む画面。
 * api の GET が employee_code を必須で要求するため、従業員を指定してから引く。
 */
export default async function CompanyEmployeeEventsPage(props: Props) {
  await requireAnyPermission(["employee:read", "org:manage", "system:admin"])

  const params = await props.searchParams

  const employeeCode = toEmployeeCode(params.employee_code)

  const kind = toKind(params.kind)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="雇用履歴" />

      <CompanyEmployeeEventFilterForm employeeCode={employeeCode} kind={kind} />

      {employeeCode === null ? (
        <EmptyState
          title="従業員コードを入力してください"
          description="雇用履歴は従業員ごとに表示します。"
        />
      ) : (
        <Suspense key={`${employeeCode}:${kind ?? ""}`} fallback={<ListSkeleton rows={5} />}>
          <CompanyEmployeeEventSection employeeCode={employeeCode} kind={kind} />
        </Suspense>
      )}
    </div>
  )
}

/** 従業員コードを単一の非空文字列に正規化する。 */
function toEmployeeCode(value: string | Array<string> | undefined): string | null {
  if (typeof value !== "string") return null

  if (value.trim() === "") return null

  return value.trim()
}

/** kind を許可された種別だけに絞り込む。範囲外は null。 */
function toKind(value: string | Array<string> | undefined): EmployeeEventKind | null {
  if (value === "join") return "join"

  if (value === "transfer") return "transfer"

  if (value === "leave_of_absence") return "leave_of_absence"

  if (value === "return") return "return"

  if (value === "retire") return "retire"

  return null
}
